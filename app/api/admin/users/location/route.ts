import { NextRequest, NextResponse } from "next/server";
import { logActivity } from "@/lib/activity";
import { requireRole } from "@/lib/auth";
import { badRequest, isUuid, serverError, trustedOrigin } from "@/lib/security";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function DELETE(req: NextRequest) {
  const actor = await requireRole(req, ["admin", "owner"]);
  if (!actor) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  if (!trustedOrigin(req)) return NextResponse.json({ error: "مصدر الطلب غير موثوق" }, { status: 403 });

  const userId = new URL(req.url).searchParams.get("id");
  if (!isUuid(userId)) return badRequest("معرّف المستخدم غير صالح");

  const { error } = await supabaseAdmin
    .from("member_location_checks")
    .delete()
    .eq("user_id", userId);
  if (error) return serverError(error, "تعذر مسح بيانات الموقع.");

  await logActivity({
    actor,
    action: "member_location_cleared",
    target_type: "user",
    target_id: userId,
    title_ar: "مسح آخر بيانات موقع لعضو بعد المراجعة",
  });

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
}
