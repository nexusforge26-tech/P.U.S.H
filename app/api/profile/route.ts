import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getRequestUser, type UserProfile } from "@/lib/auth";
import { validateProfileInput } from "@/lib/profile";

// حفظ بيانات الملف الشخصي (الاسم، الهاتف، الواتساب، الجامعة).
// الكتابة تتم عبر service_role فقط لأن جدول profiles لا يملك سياسة تعديل للمستخدمين،
// وبهذا لا يستطيع أي مستخدم تغيير دوره (role) أو بيانات غيره.
export async function PUT(req: NextRequest) {
  const account = await getRequestUser(req);
  if (!account) return NextResponse.json({ error: "يجب تسجيل الدخول أولًا" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const checked = validateProfileInput((body ?? {}) as Record<string, unknown>);
  if (!checked.valid) {
    return NextResponse.json(
      { error: "يرجى تصحيح الحقول المطلوبة", fields: checked.errors },
      { status: 400 }
    );
  }
  const { full_name, phone, whatsapp, university_id } = checked.values;

  // الجامعة يجب أن تكون من الجامعات التي أضافها المسؤولون
  const { data: uni, error: uniErr } = await supabaseAdmin
    .from("universities")
    .select("id")
    .eq("id", university_id)
    .maybeSingle();
  if (uniErr) return NextResponse.json({ error: "تعذر التحقق من الجامعة" }, { status: 500 });
  if (!uni) {
    return NextResponse.json(
      { error: "الجامعة المختارة غير موجودة", fields: { university_id: "الجامعة المختارة غير موجودة" } },
      { status: 400 }
    );
  }

  // upsert لا يلمس إلا الأعمدة المذكورة: الدور (role) يبقى كما هو للحسابات الموجودة.
  const { error } = await supabaseAdmin.from("profiles").upsert(
    {
      id: account.user.id,
      email: account.profile.email?.toLowerCase() ?? null,
      full_name,
      phone,
      whatsapp,
      university_id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
  if (error) return NextResponse.json({ error: "تعذر حفظ البيانات، حاول مرة أخرى" }, { status: 500 });

  const profile: UserProfile = { ...account.profile, full_name, phone, whatsapp, university_id };
  return NextResponse.json({ profile });
}
