import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function createUserNotification(params: {
  userId: string | null | undefined;
  title: string;
  message: string;
  link?: string | null;
}) {
  if (!params.userId) return;
  try {
    await supabaseAdmin.from("notifications").insert({
      user_id: params.userId,
      title: params.title,
      message: params.message,
      link: params.link ?? "/account",
      is_read: false,
    });
  } catch {
    // الإشعار ثانوي ولا يجب أن يفشل عملية المراجعة الأساسية.
  }
}
