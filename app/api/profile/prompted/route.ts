import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getRequestUser, invalidateAccountCache } from "@/lib/auth";
import { safeJson } from "@/lib/security";

// يسجّل مراحل تدفق إكمال البيانات (مرة واحدة لكل حساب، يُسجَّل أول وقت فقط):
//  - step = "onboarding": تم تحويل المستخدم الجديد مباشرة إلى «حسابي» بعد أول تسجيل.
//  - بدون step: عُرضت النافذة المنبثقة لهذا الحساب، فلا تظهر له مرة أخرى.
// الحماية الفعلية للعمليات تبقى في rejectIfProfileIncomplete.
export async function POST(req: NextRequest) {
  const account = await getRequestUser(req);
  if (!account) return NextResponse.json({ error: "يجب تسجيل الدخول أولًا" }, { status: 401 });

  const body = await safeJson<{ step?: unknown }>(req, 1_000);
  const now = new Date().toISOString();

  if (body?.step === "onboarding") {
    if (!account.profile.onboarding_redirected_at) {
      await supabaseAdmin
        .from("profiles")
        .update({ onboarding_redirected_at: now })
        .eq("id", account.user.id)
        .is("onboarding_redirected_at", null);
      invalidateAccountCache(account.user.id);
    }
    return NextResponse.json({ ok: true });
  }

  if (!account.profile.profile_prompted_at) {
    await supabaseAdmin
      .from("profiles")
      .update({ profile_prompted_at: now })
      .eq("id", account.user.id)
      .is("profile_prompted_at", null);
    invalidateAccountCache(account.user.id);
  }
  return NextResponse.json({ ok: true });
}
