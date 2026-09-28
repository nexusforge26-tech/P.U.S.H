import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const BUCKET = "materials";
const MAX_FILE_SIZE = 25 * 1024 * 1024;

// ينشئ الـ bucket تلقائيًا (عام) عند أول استخدام، فلا حاجة لإعداد يدوي في Supabase.
async function ensureBucket() {
  const { data } = await supabaseAdmin.storage.getBucket(BUCKET);
  if (data) return;
  const { error } = await supabaseAdmin.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: MAX_FILE_SIZE,
  });
  if (error && !/already exists/i.test(error.message)) throw new Error(error.message);
}

export async function POST(req: NextRequest) {
  const account = await getRequestUser(req);
  if (!account) return NextResponse.json({ error: "يجب تسجيل الدخول أولًا" }, { status: 401 });

  try {
    const body = await req.json();
    const fileName = String(body?.fileName || "").trim();
    const fileSize = Number(body?.fileSize);
    if (!fileName || !Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "حجم الملف غير صالح أو أكبر من الحد المسموح به (25 ميجابايت)" }, { status: 400 });
    }

    await ensureBucket();

    // اسم آمن (ASCII) لأن Supabase يرفض بعض الأحرف العربية في مسار التخزين.
    const ext = (fileName.match(/\.([A-Za-z0-9]{1,8})$/)?.[1] ?? "bin").toLowerCase();
    const path = `${account.user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data) throw new Error(error?.message || "تعذر إنشاء رابط الرفع");

    const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ bucket: BUCKET, path: data.path, token: data.token, publicUrl: pub.publicUrl });
  } catch (err: any) {
    console.error("Storage upload init error:", err);
    return NextResponse.json({ error: err?.message || "تعذر بدء الرفع" }, { status: 500 });
  }
}
