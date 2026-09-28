import { NextRequest, NextResponse } from "next/server";
import { getRequestUser, suspendedResponse } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { uploadFileToDrive } from "@/lib/googleDrive";

// الرفع يتم على السيرفر (Node runtime) لأنه يحتاج مكتبة googleapis وتيار بيانات حقيقي.
export const runtime = "nodejs";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

export async function POST(req: NextRequest) {
  // فقط الملفات التي يتم تخزينها فعليًا في Drive تمر من هنا، لذا نطلب تسجيل
  // الدخول لمنع إساءة استخدام مساحة تخزين الموقع.
  const account = await getRequestUser(req);
  if (!account) return NextResponse.json({ error: "يجب تسجيل الدخول أولًا" }, { status: 401 });
  const blocked = suspendedResponse(account); if (blocked) return blocked;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "تعذرت قراءة الملف المُرسَل" }, { status: 400 });
  }

  const file = form.get("file");
  const courseId = String(form.get("course_id") ?? "").trim();
  if (!(file instanceof File)) return NextResponse.json({ error: "لم يتم إرفاق أي ملف" }, { status: 400 });
  if (!courseId) return NextResponse.json({ error: "اختر المساق أولًا قبل رفع الملف" }, { status: 400 });
  if (file.size === 0) return NextResponse.json({ error: "الملف فارغ" }, { status: 400 });
  if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "حجم الملف أكبر من الحد المسموح به (25 ميجابايت)" }, { status: 400 });

  // يُخزَّن الملف داخل مجلد المساق نفسه في Drive، لذا يجب أن يكون المساق موجودًا.
  const { data: course } = await supabaseAdmin.from("courses").select("id,name_ar,code").eq("id", courseId).maybeSingle();
  if (!course) return NextResponse.json({ error: "المساق غير موجود" }, { status: 404 });

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const uploaded = await uploadFileToDrive({
      buffer,
      fileName: file.name,
      mimeType: file.type,
      courseId: course.id,
      courseName: course.code ? `${course.name_ar} (${course.code})` : course.name_ar,
      uploaderId: account.user.id,
    });
    return NextResponse.json({ drive_link: uploaded.link, file_name: uploaded.name, file_id: uploaded.id }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "تعذر رفع الملف إلى Google Drive" }, { status: 500 });
  }
}
