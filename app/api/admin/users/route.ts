import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  requireStaff,
  validateRoleChange,
  validateUserDeletion,
  type UserRole,
} from "@/lib/auth";
import { isUserRole } from "@/lib/roles";
import { logActivity } from "@/lib/activity";
import { badRequest, isUuid, safeJson, sanitizeFilterTerm, serverError } from "@/lib/security";

const PROFILE_COLUMNS =
  "id,email,full_name,avatar_url,role,phone,whatsapp,university_id,managed_university_id,created_at,updated_at";

export async function GET(req: NextRequest) {
  const actor = await requireStaff(req);
  if (!actor) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const roleFilter = searchParams.get("role")?.trim() ?? "";
  const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(10, Number(searchParams.get("pageSize") ?? 25) || 25));
  const from = (page - 1) * pageSize;

  let query = supabaseAdmin
    .from("profiles")
    .select(
      `${PROFILE_COLUMNS},universities:university_id(name_ar),managed_university:managed_university_id(name_ar)`,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);

  // مسؤول الجامعة يرى أعضاء جامعته فقط (الفلترة هنا على السيرفر ولا يمكن تجاوزها من الواجهة).
  if (actor.scopeUniversityId) {
    query = query.eq("university_id", actor.scopeUniversityId);
  }

  if (roleFilter && isUserRole(roleFilter)) {
    query = query.eq("role", roleFilter);
  }
  if (q) {
    const safe = sanitizeFilterTerm(q, 100);
    if (safe) {
      query = query.or(
        `full_name.ilike.%${safe}%,email.ilike.%${safe}%,phone.ilike.%${safe}%,whatsapp.ilike.%${safe}%`
      );
    }
  }

  const { data, count, error } = await query;
  if (error) return serverError(error);

  return NextResponse.json({
    users: data ?? [],
    count: count ?? 0,
    page,
    pageSize,
    actorRole: actor.profile.role,
    scopeUniversityId: actor.scopeUniversityId,
  });
}

export async function PATCH(req: NextRequest) {
  const actor = await requireStaff(req);
  if (!actor) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const body = await safeJson<{ id?: unknown; role?: unknown; university_id?: unknown }>(req, 10_000);
  if (!body) return badRequest();
  const id = body.id;
  const role = body.role as UserRole;
  const university_id = body.university_id;
  if (!isUuid(id) || !isUserRole(role)) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }
  if (university_id !== undefined && university_id !== null && university_id !== "" && !isUuid(university_id)) {
    return badRequest("الجامعة المحددة غير صالحة");
  }

  const { data: target } = await supabaseAdmin
    .from("profiles")
    .select("id,email,role,university_id,full_name")
    .eq("id", id)
    .maybeSingle();

  if (!target) return NextResponse.json({ error: "المستخدم غير موجود" }, { status: 404 });

  const check = validateRoleChange({
    actorId: actor.user.id,
    actorRole: actor.profile.role,
    targetId: target.id,
    targetEmail: target.email,
    targetRole: target.role as UserRole,
    newRole: role,
  });

  if (!check.allowed) {
    return NextResponse.json({ error: check.error }, { status: 403 });
  }

  // ترقية إلى «مسؤول جامعة»: الجامعة المُدارة = الجامعة المحددة صراحةً، وإلا جامعة العضو نفسه.
  let managedUniversityId: string | null = null;
  let managedUniversityName: string | null = null;
  if (role === "uni_admin") {
    managedUniversityId = (typeof university_id === "string" && university_id) || target.university_id || null;
    if (!managedUniversityId) {
      return NextResponse.json(
        { error: "لا يمكن تعيين مسؤول جامعة بلا جامعة. اطلب من العضو اختيار جامعته أولًا أو حدّد الجامعة." },
        { status: 400 }
      );
    }
    const { data: uni } = await supabaseAdmin
      .from("universities")
      .select("id,name_ar")
      .eq("id", managedUniversityId)
      .maybeSingle();
    if (!uni) return NextResponse.json({ error: "الجامعة المحددة غير موجودة" }, { status: 400 });
    managedUniversityName = uni.name_ar;
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({
      role,
      // أي دور غير مسؤول الجامعة يفقد ارتباطه بجامعة الإدارة
      managed_university_id: managedUniversityId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(PROFILE_COLUMNS)
    .single();

  if (error) return serverError(error);

  await logActivity({
    actor,
    action: "role_changed",
    target_type: "user",
    target_id: id,
    title_ar: `${target.full_name || target.email || "عضو"}: ${target.role} ← ${role}${
      managedUniversityName ? ` (${managedUniversityName})` : ""
    }`,
    university_id: managedUniversityId ?? target.university_id ?? null,
  });

  return NextResponse.json({ user: data });
}

export async function DELETE(req: NextRequest) {
  const actor = await requireStaff(req);
  if (!actor) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "معرّف المستخدم مطلوب" }, { status: 400 });
  if (!isUuid(id)) return badRequest("معرّف المستخدم غير صالح");

  const { data: target } = await supabaseAdmin
    .from("profiles")
    .select("id,email,full_name,role")
    .eq("id", id)
    .maybeSingle();

  if (!target) return NextResponse.json({ error: "المستخدم غير موجود" }, { status: 404 });

  const check = validateUserDeletion({
    actorId: actor.user.id,
    actorRole: actor.profile.role,
    targetId: target.id,
    targetEmail: target.email,
    targetRole: target.role as UserRole,
  });

  if (!check.allowed) {
    return NextResponse.json({ error: check.error }, { status: 403 });
  }

  // قبل حذف الحساب، نحفظ الاسم والبريد في المساهمات ونفك الارتباط (user_id = null)
  // حتى لا تضيع المساهمات السابقة من الأرشيف حتى لو كانت القاعدة قديمة بـ on delete cascade
  await supabaseAdmin
    .from("submissions")
    .update({
      user_id: null,
      submitter_name: target.full_name,
      submitter_email: target.email,
    })
    .eq("user_id", id);

  await supabaseAdmin
    .from("doctor_submissions")
    .update({
      user_id: null,
      submitter_name: target.full_name,
      submitter_email: target.email,
    })
    .eq("user_id", id);

  const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
  if (error) return serverError(error);

  await logActivity({
    actor,
    action: "user_deleted",
    target_type: "user",
    target_id: id,
    title_ar: `حذف حساب: ${target.full_name || target.email || "عضو"}`,
  });
  return NextResponse.json({ ok: true });
}
