import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getRequestUser } from "@/lib/auth";
import { isUuid, rateLimit, serverError, tooManyRequests } from "@/lib/security";

// تصويت «مفيد»: يتطلب تسجيل الدخول (صوت واحد لكل حساب لكل مادة).
// كان التصويت متاحًا للزوار بلا حد فيمكن تضخيم العداد بتكرار الطلب، وكان العدّ يتم بقراءة ثم كتابة
// (Race Condition) فيُحتسب صوت إضافي عند تزامن طلبين، وكان يُزاد العداد حتى لو فشل تسجيل الصوت.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const materialId = params.id;
  if (!isUuid(materialId)) return NextResponse.json({ error: "معرّف غير صالح" }, { status: 400 });

  const account = await getRequestUser(req);
  if (!account) {
    return NextResponse.json({ error: "سجّل الدخول لتتمكن من التصويت", code: "AUTH_REQUIRED" }, { status: 401 });
  }

  const limit = rateLimit(`vote:${account.user.id}`, 30, 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSec);

  try {
    // 1) المسار الذري (دالة قاعدة البيانات من ترحيل 2026-10-18)
    const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc("cast_helpful_vote", {
      p_material_id: materialId,
      p_user_id: account.user.id,
    });

    if (!rpcError) {
      const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
      if (!row) return NextResponse.json({ error: "المادة غير موجودة" }, { status: 404 });
      return NextResponse.json({
        ok: true,
        alreadyVoted: Boolean(row.already_voted),
        helpful_count: Number(row.helpful_count ?? 0),
      });
    }

    // 2) توافق مع قاعدة لم تُنفَّذ عليها الدالة بعد: نسجّل الصوت أولًا ولا نزيد العداد إلا عند نجاح التسجيل.
    console.error("[helpful] cast_helpful_vote unavailable, using fallback:", rpcError.message);

    const { data: mat } = await supabaseAdmin
      .from("materials")
      .select("id,helpful_count")
      .eq("id", materialId)
      .maybeSingle();
    if (!mat) return NextResponse.json({ error: "المادة غير موجودة" }, { status: 404 });

    const { error: insertError } = await supabaseAdmin
      .from("material_votes")
      .insert({ material_id: materialId, user_id: account.user.id });

    if (insertError) {
      // تعارض المفتاح الأساسي = صوّت سابقًا
      return NextResponse.json({ ok: true, alreadyVoted: true, helpful_count: Number(mat.helpful_count ?? 0) });
    }

    const nextCount = Number(mat.helpful_count ?? 0) + 1;
    await supabaseAdmin.from("materials").update({ helpful_count: nextCount }).eq("id", materialId);
    return NextResponse.json({ ok: true, helpful_count: nextCount });
  } catch (err) {
    return serverError(err);
  }
}
