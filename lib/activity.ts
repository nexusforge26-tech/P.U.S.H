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
  /** الجامعة المرتبطة بالعملية (لتقييد السجل على مسؤول الجامعة). تُستنتج تلقائيًا من المساق إن لم تُمرَّر. */
  university_id?: string | null;
}) {
  try {
    let universityId = params.university_id ?? null;
    if (!universityId && params.course_id) {
      const { data } = await supabaseAdmin
        .from("courses")
        .select("university_id")
        .eq("id", params.course_id)
        .maybeSingle();
      universityId = data?.university_id ?? null;
    }
    if (!universityId && params.target_type === "university") {
      universityId = params.target_id ?? null;
    }
    // آخر خيار: عمليات مسؤول الجامعة تُنسب دائمًا إلى جامعته.
    if (!universityId) {
      universityId =
        (params.actor?.profile as { managed_university_id?: string | null } | undefined)
          ?.managed_university_id ?? null;
    }

    await supabaseAdmin.from("activity_log").insert({
      university_id: universityId,
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
