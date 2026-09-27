import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole, type UserRole } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const actor = await requireRole(req, ["admin","owner"]);
  if (!actor) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const { data, error } = await supabaseAdmin.from("profiles").select("id,email,full_name,avatar_url,role,created_at,updated_at").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ users: data ?? [], actorRole: actor.profile.role });
}

export async function PATCH(req: NextRequest) {
  const actor = await requireRole(req, ["admin","owner"]);
  if (!actor) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const { id, role } = await req.json() as { id?: string; role?: UserRole };
  if (!id || !["user","admin","owner"].includes(role ?? "")) return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });

  const { data: target } = await supabaseAdmin.from("profiles").select("id,email,role").eq("id", id).maybeSingle();
  if (!target) return NextResponse.json({ error: "المستخدم غير موجود" }, { status: 404 });

  // Only the owner can grant/revoke the owner role. The configured owner
  // email cannot be demoted by anyone.
  const ownerEmail = "ydha957@gmail.com";
  if (String(target.email).toLowerCase() === ownerEmail && role !== "owner") {
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

  const { data, error } = await supabaseAdmin.from("profiles").update({ role, updated_at: new Date().toISOString() }).eq("id", id).select("id,email,full_name,avatar_url,role,created_at,updated_at").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ user: data });
}
