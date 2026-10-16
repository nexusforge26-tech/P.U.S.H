import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  requireRole,
  validateRoleChange,
  validateUserDeletion,
  type UserRole,
} from "@/lib/auth";

export async function GET(req: NextRequest) {
  const actor = await requireRole(req, ["admin", "owner"]);
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
      "id,email,full_name,avatar_url,role,phone,whatsapp,university_id,created_at,updated_at,universities:university_id(name_ar)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);

  if (roleFilter && ["user", "admin", "owner"].includes(roleFilter)) {
    query = query.eq("role", roleFilter);
  }
  if (q) {
    const safe = q.replace(/[,()%*]/g, " ").trim();
    if (safe) {
      query = query.or(
        `full_name.ilike.%${safe}%,email.ilike.%${safe}%,phone.ilike.%${safe}%,whatsapp.ilike.%${safe}%`
      );
    }
  }

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    users: data ?? [],
    count: count ?? 0,
    page,
    pageSize,
    actorRole: actor.profile.role,
  });
}

export async function PATCH(req: NextRequest) {
  const actor = await requireRole(req, ["admin", "owner"]);
  if (!actor) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { id, role } = (await req.json()) as { id?: string; role?: UserRole };
  if (!id || !role) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const { data: target } = await supabaseAdmin
    .from("profiles")
    .select("id,email,role")
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

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({ role, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id,email,full_name,avatar_url,role,phone,whatsapp,university_id,created_at,updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ user: data });
}

export async function DELETE(req: NextRequest) {
  const actor = await requireRole(req, ["admin", "owner"]);
  if (!actor) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "معرّف المستخدم مطلوب" }, { status: 400 });

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
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
