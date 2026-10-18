import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { deleteDriveFile } from "@/lib/googleDrive";
import { extractDriveFileId } from "@/lib/validation";

/**
 * حذف آمن لملف من Google Drive.
 *
 * المشكلة التي تعالجها: رابط الملف عام ومكشوف في صفحة المادة، فيستطيع أي مستخدم إرسال مساهمة
 * (أو إنشاء مادة) تشير لنفس ملف Drive الخاص بمادة منشورة؛ وعند رفض/حذف تلك المساهمة كان الكود
 * القديم يحذف الملف الفعلي من Drive ويكسر المادة الأصلية. الآن لا نحذف الملف إلا إذا لم تعد
 * أي مادة منشورة ولا أي مساهمة معلّقة تشير إليه.
 */
export async function deleteDriveFileIfUnreferenced(
  driveLink: string | null | undefined,
  options: { excludeMaterialId?: string; excludeSubmissionId?: string } = {}
): Promise<boolean> {
  if (!driveLink) return false;
  const fileId = extractDriveFileId(driveLink);
  if (!fileId) return false;

  // معرّف Drive لا يحتوي إلا [A-Za-z0-9_-]؛ والشرطة السفلية في LIKE تطابق أي حرف (نتيجتها فقط حماية زائدة).
  const pattern = `%${fileId}%`;

  let materialsQuery = supabaseAdmin
    .from("materials")
    .select("id", { count: "exact", head: true })
    .like("drive_link", pattern);
  if (options.excludeMaterialId) materialsQuery = materialsQuery.neq("id", options.excludeMaterialId);
  const { count: materialRefs, error: matErr } = await materialsQuery;

  let submissionsQuery = supabaseAdmin
    .from("submissions")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .like("drive_link", pattern);
  if (options.excludeSubmissionId) submissionsQuery = submissionsQuery.neq("id", options.excludeSubmissionId);
  const { count: submissionRefs, error: subErr } = await submissionsQuery;

  // عند أي خطأ في الفحص نفضّل عدم الحذف (حذف ملف مستخدم أخطر من ترك ملف يتيم).
  if (matErr || subErr) return false;
  if ((materialRefs ?? 0) > 0 || (submissionRefs ?? 0) > 0) return false;

  return deleteDriveFile(fileId);
}

/** هل يشير أي سجل مادة منشورة إلى نفس ملف Drive؟ (لمنع تكرار/اختطاف ملفات الغير) */
export async function isDriveFileUsedByMaterial(driveLink: string | null | undefined): Promise<boolean> {
  if (!driveLink) return false;
  const fileId = extractDriveFileId(driveLink);
  if (!fileId) return false;
  const { count } = await supabaseAdmin
    .from("materials")
    .select("id", { count: "exact", head: true })
    .like("drive_link", `%${fileId}%`);
  return (count ?? 0) > 0;
}
