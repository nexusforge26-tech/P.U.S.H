import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getRequestUser } from "@/lib/auth";

// يسجّل أن نافذة إكمال البيانات عُرضت لهذا الحساب، فلا تظهر له مرة أخرى.
// يُسجَّل أول وقت فقط (لا يُستبدل). الحماية الفعلية للعمليات تبقى في rejectIfProfileIncomplete.
export async function POST(req: NextRequest) {
  const account = await getRequestUser(req);
  if (!account) return NextResponse.json({ error: "يجب تسجيل الدخول أولًا" }, { status: 401 });

  if (!account.profile.profile_prompted_at) {
    await supabaseAdmin
      .from("profiles")
      .update({ profile_prompted_at: new Date().toISOString() })
      .eq("id", account.user.id)
      .is("profile_prompted_at", null);
  }
  return NextResponse.json({ ok: true });
}
