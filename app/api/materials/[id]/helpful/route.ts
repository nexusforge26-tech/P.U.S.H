import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getRequestUser } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const materialId = params.id;
  if (!materialId) return NextResponse.json({ error: "معرّف غير صالح" }, { status: 400 });

  const account = await getRequestUser(req);

  try {
    const { data: mat } = await supabaseAdmin
      .from("materials")
      .select("id,helpful_count")
      .eq("id", materialId)
      .maybeSingle();

    if (!mat) return NextResponse.json({ error: "المادة غير موجودة" }, { status: 404 });

    if (account) {
      const { data: existingVote, error: voteCheckErr } = await supabaseAdmin
        .from("material_votes")
        .select("material_id")
        .eq("material_id", materialId)
        .eq("user_id", account.user.id)
        .maybeSingle();

      if (!voteCheckErr && existingVote) {
        return NextResponse.json({
          ok: true,
          alreadyVoted: true,
          helpful_count: mat.helpful_count ?? 0,
        });
      }

      await supabaseAdmin
        .from("material_votes")
        .insert({ material_id: materialId, user_id: account.user.id });
    }

    const nextCount = Number(mat.helpful_count ?? 0) + 1;
    await supabaseAdmin
      .from("materials")
      .update({ helpful_count: nextCount })
      .eq("id", materialId);

    return NextResponse.json({ ok: true, helpful_count: nextCount });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
