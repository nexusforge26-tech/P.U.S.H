import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, type UserRole } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { trashDriveLink } from "@/lib/googleDrive";

const OWNER_EMAIL = "ydha957@gmail.com";
const COLUMNS = "id,email,full_name,avatar_url,role,created_at,updated_at,suspended_at";

export async function GET(req: NextRequest) {
  const actor = await requireRole(req, ["admin","owner"]);
  if (!actor) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const { data, error } = await supabaseAdmin.from("profiles").select(COLUMNS).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ users: data ?? [], actorRole: actor.profile.role, actorId: actor.user.id });
}

// قواعد من يستطيع التصرف بحساب من (إيقاف/حذف):
//  - لا أحد يتصرف بحسابه هو.
//  - مالك الموقع الأساسي محمي دائمًا.
//  - المالك يتصرف بالمسؤولين والمستخدمين، والمسؤول بالمستخدمين العاديين فقط.
function canManage(actor: { user: { id: string }; profile: { role: string } }, target: { id: string; email: string | null; role: string }): string | null {
  if (target.id === actor.user.id) return "لا يمكنك تنفيذ هذا الإجراء على حسابك أنت.";
  if (String(target.email).toLowerCase() === OWNER_EMAIL || target.role === "owner") return "لا يمكن تنفيذ هذا الإجراء على حساب المالك.";
  if (target.role === "admin" && actor.profile.role !== "owner") return "إدارة حسابات المسؤولين متاحة للمالك فقط.";
  return null;
}

async function loadTarget(id: string) {
  const { data } = await supabaseAdmin.from("profiles").select("id,email,full_name,role,suspended_at").eq("id", id).maybeSingle();
  return data;
}

export async function PATCH(req: NextRequest) {
  const actor = await requireRole(req, ["admin","owner"]);
  if (!actor) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const { id, role, action } = await req.json() as { id?: string; role?: UserRole; action?: "suspend" | "unsuspend" };
  if (!id) return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });

  const target = await loadTarget(id);
  if (!target) return NextResponse.json({ error: "المستخدم غير موجود" }, { status: 404 });

  // إيقاف الحساب أو إعادة تفعيله: الحساب الموقوف يبقى يتصفح لكنه لا يستطيع
  // إرسال مساهمات ولا رفع ملفات ولا تعديل منشوراته.
  if (action === "suspend" || action === "unsuspend") {
    const denied = canManage(actor, target);
    if (denied) return NextResponse.json({ error: denied }, { status: 403 });
    const { data, error } = await supabaseAdmin.from("profiles")
      .update({ suspended_at: action === "suspend" ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
      .eq("id", id).select(COLUMNS).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await logActivity({ actor, action: action === "suspend" ? "user_suspended" : "user_unsuspended", target_type: "user", target_id: id, title_ar: target.full_name || target.email });
    return NextResponse.json({ user: data });
  }

  if (![ "user","admin","owner" ].includes(role ?? "")) return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });

  // Only the owner can grant/revoke the owner role. The configured owner
  // email cannot be demoted by anyone.
  if (String(target.email).toLowerCase() === OWNER_EMAIL && role !== "owner") {
    return NextResponse.json({ error: "لا يمكن خفض صلاحية مالك الموقع الأساسي." }, { status: 403 });
  }
  if (role === "owner" && actor.profile.role !== "owner") {
    return NextResponse.json({ error: "ترقية مستخدم إلى مالك متاحة للمالك فقط." }, { status: 403 });
  }
  if (target.role === "owner" && actor.profile.role !== "owner") {
    return NextResponse.json({ error: "لا يمكن تعديل صلاحيات المالك." }, { status: 403 });
  }
  if (target.id === actor.user.id && role !== "owner") {
    return NextResponse.json({ error: "لا يمكنك خفض صلاحيتك بنفسك." }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin.from("profiles").update({ role, updated_at: new Date().toISOString() }).eq("id", id).select(COLUMNS).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logActivity({ actor, action: "user_role_changed", target_type: "user", target_id: id, title_ar: `${target.full_name || target.email} ← ${role}` });
  return NextResponse.json({ user: data });
}

// حذف حساب عضو نهائيًا: يُحذف من Supabase Auth فتُحذف معه بياناته (profiles وsubmissions)
// تلقائيًا. المواد التي نُشرت باسمه تبقى في الموقع (created_by يصبح فارغًا).
export async function DELETE(req: NextRequest) {
  const actor = await requireRole(req, ["admin","owner"]);
  if (!actor) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "معرّف المستخدم مطلوب" }, { status: 400 });

  const target = await loadTarget(id);
  if (!target) return NextResponse.json({ error: "المستخدم غير موجود" }, { status: 404 });
  const denied = canManage(actor, target);
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });

  // ملفات مساهماته غير المنشورة (معلّقة/مرفوضة) ستفقد سجلاتها، فننقلها إلى سلة Drive.
  const { data: orphaned } = await supabaseAdmin.from("submissions").select("drive_link").eq("user_id", id).neq("status", "approved");

  const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  for (const s of orphaned ?? []) await trashDriveLink(s.drive_link);
  await logActivity({ actor, action: "user_deleted", target_type: "user", target_id: null, title_ar: target.full_name || target.email });
  return NextResponse.json({ ok: true });
}
