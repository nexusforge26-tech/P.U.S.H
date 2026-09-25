import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getRequestUser } from "@/lib/auth";

function extractYoutubeId(input: string): string | null {
  const trimmed = input.trim();
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.hostname.includes("youtu.be")) return url.pathname.slice(1).match(/^[\w-]{11}/)?.[0] ?? null;
    if (url.searchParams.get("v")) return url.searchParams.get("v");
    return url.pathname.match(/\/(?:shorts|embed)\/([\w-]{11})/)?.[1] ?? null;
  } catch { return null; }
}

export async function GET(req: NextRequest) {
  const account = await getRequestUser(req);
  if (!account) return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 });
  const { data, error } = await supabaseAdmin.from("submissions")
    .select("id,title_ar,type,status,admin_note,created_at,reviewed_at,courses:course_id(name_ar)")
    .eq("user_id", account.user.id).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ submissions: data ?? [] });
}

export async function POST(req: NextRequest) {
  const account = await getRequestUser(req);
  if (!account) return NextResponse.json({ error: "يجب تسجيل الدخول أولًا" }, { status: 401 });
  const body = await req.json();
  const { course_id, title_ar, description_ar, type, academic_year, semester, drive_link, youtube_input } = body;
  if (!course_id || !title_ar || !type) return NextResponse.json({ error: "الحقول الأساسية ناقصة" }, { status: 400 });

  const payload: any = {
    user_id: account.user.id, course_id, title_ar, description_ar: description_ar || null,
    type, academic_year: academic_year || null, semester: semester || null, drive_link: null, youtube_id: null,
  };
  if (type === "video") {
    const id = extractYoutubeId(String(youtube_input ?? ""));
    if (!id) return NextResponse.json({ error: "رابط YouTube غير صالح" }, { status: 400 });
    payload.youtube_id = id;
  } else {
    if (!drive_link?.trim()) return NextResponse.json({ error: "رابط Google Drive مطلوب" }, { status: 400 });
    payload.drive_link = drive_link.trim();
  }

  const { data, error } = await supabaseAdmin.from("submissions").insert(payload).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ submission: data }, { status: 201 });
}
