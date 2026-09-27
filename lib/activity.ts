import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

interface Actor {
  user: { id: string; email?: string | null };
  profile: { full_name: string | null; email: string | null };
}

// يسجّل كل عملية إضافة/نشر/تعديل/حذف في جدول activity_log ليظهر لاحقًا في
// "سجل المنشورات" داخل لوحة الإدارة (يظهر فقط للمسؤول والمالك). عدم قدرة هذا
// السجل على الحفظ لا يجب أن يفشل الطلب الأساسي، لذلك يتم تجاهل أي خطأ هنا.
export async function logActivity(params: {
  actor: Actor | { user: { id: string }; profile: { full_name?: string | null; email?: string | null } } | null;
  action: string;
  target_type: string;
  target_id?: string | null;
  title_ar?: string | null;
  course_id?: string | null;
}) {
  try {
    await supabaseAdmin.from("activity_log").insert({
      actor_id: params.actor?.user?.id ?? null,
      actor_name: params.actor?.profile?.full_name ?? null,
      actor_email: params.actor?.profile?.email ?? null,
      action: params.action,
      target_type: params.target_type,
      target_id: params.target_id ?? null,
      title_ar: params.title_ar ?? null,
      course_id: params.course_id ?? null,
    });
  } catch {
    // تجاهل: السجل ثانوي ولا يجب أن يوقف العملية الأساسية.
  }
}
