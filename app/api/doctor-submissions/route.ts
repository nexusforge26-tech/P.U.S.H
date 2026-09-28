import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getRequestUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

export async function GET(req: NextRequest) {
  const account = await getRequestUser(req);
  if (!account) return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 });
  const { data, error } = await supabaseAdmin
    .from("doctor_submissions")
    .select("id,kind,target_doctor_id,full_name,email,phone,office_location,courses,status,admin_note,created_at,reviewed_at,universities:university_id(name_ar),faculties:faculty_id(name_ar)")
    .eq("user_id", account.user.id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ submissions: data ?? [] });
}

export async function POST(req: NextRequest) {
  const account = await getRequestUser(req);
  if (!account) return NextResponse.json({ error: "يجب تسجيل الدخول أولًا" }, { status: 401 });
  const body = await req.json();
  const kind = body.kind === "edit" ? "edit" : "new";
  const { full_name, email, phone, office_location, university_id, faculty_id, target_doctor_id } = body;
  const courses: string[] = Array.isArray(body.courses) ? body.courses.map((c: string) => String(c).trim()).filter(Boolean) : [];

  if (!full_name?.trim() || !email?.trim() || !university_id || !faculty_id || courses.length === 0) {
    return NextResponse.json({ error: "الاسم الكامل والبريد الإلكتروني والجامعة والكلية والمساق (مساق واحد على الأقل) حقول إجبارية" }, { status: 400 });
  }
  if (kind === "edit" && !target_doctor_id) {
    return NextResponse.json({ error: "لا يمكن إرسال تعديل بدون تحديد الدكتور المطلوب تعديله" }, { status: 400 });
  }

  const payload = {
    user_id: account.user.id,
    kind,
    target_doctor_id: kind === "edit" ? target_doctor_id : null,
    full_name: full_name.trim(),
    email: email.trim(),
    phone: phone?.trim() || null,
    office_location: office_location?.trim() || null,
    university_id,
    faculty_id,
    courses,
  };

  const { data, error } = await supabaseAdmin.from("doctor_submissions").insert(payload).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logActivity({ actor: account, action: "doctor_submission_created", target_type: "doctor_submission", target_id: data.id, title_ar: data.full_name });
  return NextResponse.json({ submission: data }, { status: 201 });
}
