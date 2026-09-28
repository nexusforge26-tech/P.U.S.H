import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth";
import { uploadFileToDrive } from "@/lib/googleDrive";

// الرفع يتم على السيرفر (Node runtime) لأنه يحتاج مكتبة googleapis وتيار بيانات حقيقي.
export const runtime = "nodejs";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

export async function POST(req: NextRequest) {
  // فقط الملفات التي يتم تخزينها فعليًا في Drive تمر من هنا، لذا نطلب تسجيل
  // الدخول لمنع إساءة استخدام مساحة تخزين الموقع.
  const account = await getRequestUser(req);
  if (!account) return NextResponse.json({ error: "يجب تسجيل الدخول أولًا" }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "تعذرت قراءة الملف المُرسَل" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "لم يتم إرفاق أي ملف" }, { status: 400 });
  if (file.size === 0) return NextResponse.json({ error: "الملف فارغ" }, { status: 400 });
  if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "حجم الملف أكبر من الحد المسموح به (25 ميجابايت)" }, { status: 400 });

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const uploaded = await uploadFileToDrive(buffer, file.name, file.type);
    return NextResponse.json({ drive_link: uploaded.link, file_name: uploaded.name, file_id: uploaded.id }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "تعذر رفع الملف إلى Google Drive" }, { status: 500 });
  }
}
