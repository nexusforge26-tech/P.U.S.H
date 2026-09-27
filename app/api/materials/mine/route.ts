import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getRequestUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { SELF_EDIT_WINDOW_HOURS } from "@/lib/types";

const WINDOW_MS = SELF_EDIT_WINDOW_HOURS * 60 * 60 * 1000;

const select = `
  id, course_id, title_ar, description_ar, type, academic_year, semester,
  drive_link, youtube_id, is_featured, downloads_count, created_at, created_by,
  courses:course_id ( name_ar, code, faculties:faculty_id ( name_ar, universities:university_id ( name_ar ) ) )
`;

function flatten(row: any) {
  return {
    ...row,
    course_name: row.courses?.name_ar ?? null,
    course_code: row.courses?.code ?? null,
    faculty_name: row.courses?.faculties?.name_ar ?? null,
    university_name: row.courses?.faculties?.universities?.name_ar ?? null,
    editable: Date.now() - new Date(row.created_at).getTime() < WINDOW_MS,
  };
}

function extractYoutubeId(input: string): string | null {
  const trimmed = input.trim();
  if (/^[\w-]{11}/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.hostname.includes("youtu.be")) return url.pathname.slice(1).match(/^[\w-]{11}/)?.[0] ?? null;
    if (url.searchParams.get("v")) return url.searchParams.get("v");
    return url.pathname.match(/\/(?:shorts|embed)\/([\w-]{11})/)?.[1] ?? null;
  } catch { return null; }
}

export async function GET(req: NextRequest) {
  const account = await getRequestUser(req);
  if (!account) return NextResponse.json({ error: "يجب تسجيل الدخول أولًا" }, { status: 401 });
  const { data, error } = await supabaseAdmin.from("materials").select(select).eq("created_by", account.user.id).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: (data ?? []).map(flatten) });
}

async function loadOwned(id: string, userId: string) {
  const { data } = await supabaseAdmin.from("materials").select("id,title_ar,course_id,created_by,created_at").eq("id", id).maybeSingle();
  if (!data || data.created_by !== userId) return { error: NextResponse.json({ error: "هذه المادة ليست ضمن منشوراتك" }, { status: 403 }) };
  if (Date.now() - new Date(data.created_at).getTime() >= WINDOW_MS) {
    return { error: NextResponse.json({ error: `انتهت مهلة ${SELF_EDIT_WINDOW_HOURS} ساعات المسموحة للتعديل. تواصل مع الإدارة لتعديل هذه المادة.` }, { status: 403 }) };
  }
  return { data };
}

export async function PATCH(req: NextRequest) {
  const account = await getRequestUser(req);
  if (!account) return NextResponse.json({ error: "يجب تسجيل الدخول أولًا" }, { status: 401 });
  const body = await req.json();
  const { id, title_ar, description_ar, academic_year, semester, drive_link, youtube_input } = body;
  if (!id || !title_ar) return NextResponse.json({ error: "الحقول الأساسية ناقصة" }, { status: 400 });

  const owned = await loadOwned(id, account.user.id);
  if (owned.error) return owned.error;

  const { data: existing } = await supabaseAdmin.from("materials").select("type").eq("id", id).single();
  const payload: Record<string, unknown> = {
    title_ar, description_ar: description_ar || null,
    academic_year: academic_year || null, semester: semester || null,
  };
  if (existing?.type === "video") {
    const youtubeId = extractYoutubeId(String(youtube_input ?? ""));
    if (!youtubeId) return NextResponse.json({ error: "رابط YouTube غير صالح" }, { status: 400 });
    payload.youtube_id = youtubeId;
  } else if (drive_link !== undefined) {
    if (!String(drive_link).trim()) return NextResponse.json({ error: "رابط Google Drive مطلوب" }, { status: 400 });
    payload.drive_link = String(drive_link).trim();
  }

  const { data, error } = await supabaseAdmin.from("materials").update(payload).eq("id", id).select(select).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logActivity({ actor: account, action: "material_edited_by_owner", target_type: "material", target_id: id, title_ar: data.title_ar, course_id: data.course_id });
  return NextResponse.json({ data: flatten(data) });
}

export async function DELETE(req: NextRequest) {
  const account = await getRequestUser(req);
  if (!account) return NextResponse.json({ error: "يجب تسجيل الدخول أولًا" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "معرّف المادة مطلوب" }, { status: 400 });

  const owned = await loadOwned(id, account.user.id);
  if (owned.error) return owned.error;

  const { error } = await supabaseAdmin.from("materials").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logActivity({ actor: account, action: "material_deleted_by_owner", target_type: "material", target_id: id, title_ar: owned.data!.title_ar, course_id: owned.data!.course_id });
  return NextResponse.json({ ok: true });
}
