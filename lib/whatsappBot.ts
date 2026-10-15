import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { buildArabicSearchVariants } from "@/lib/arabic";
import { MATERIAL_TYPE_LABELS, type MaterialType } from "@/lib/types";

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

interface ExtractedQuery {
  keywords: string[];
  courseCode: string | null;
  type: MaterialType | null;
  university: string | null;
  isGreetingOnly: boolean;
}

/**
 * يستعمل Gemini API لتحليل رسالة الطالب على واتساب واستخراج اسم المساق أو رمزه ونوع المادة المطلوبة.
 */
async function analyzeStudentRequestWithGemini(userMessage: string): Promise<ExtractedQuery> {
  const apiKey = process.env.GEMINI_API_KEY;
  const fallback: ExtractedQuery = {
    keywords: [userMessage.trim()],
    courseCode: userMessage.match(/\b(\d{4,9}|[A-Za-z]{2,4}\s?\d{3,4})\b/)?.[1] ?? null,
    type: userMessage.includes("امتحان") || userMessage.includes("مد") || userMessage.includes("فاينل")
      ? "exam"
      : userMessage.includes("ملخص") || userMessage.includes("تلخيص")
      ? "summary"
      : null,
    university: null,
    isGreetingOnly: /^(مرحب|سلام|اهلا|أهلا|هلا|هاي|hi|hello|مساء|صباح)/i.test(userMessage.trim()) && userMessage.trim().split(/\s+/).length <= 3,
  };

  if (!apiKey) return fallback;

  try {
    const prompt = `أنت مساعد ذكي لمنصة PUSH الطلابية للجامعات الفلسطينية.
حلل رسالة الطالب التالية واستخرج بيانات البحث بصيغة JSON فقط بدون أي نص إضافي:
رسالة الطالب: "${userMessage}"

المطلوب إرجاع كائن JSON بالحقول التالية:
- "keywords": مصفوفة كلمات مفتاحية لاسم المساق أو عنوان المادة بالعربية أو الإنجليزية (بدون كلمات عامة مثل "أريد"، "بدي"، "لو سمحت"، "ملف"، "امتحان"، "ملخص").
- "courseCode": رمز أو رقم المساق إن وُجد (مثل "4106" أو "CS201") أو null.
- "type": نوع المادة إن حدده الطالب: "exam" للامتحانات/أسئلة السنوات، "summary" للملخصات/الحلول، "file" للكتب/السلايدات/التقارير، "video" للفيديوهات، أو null للكل.
- "university": اسم الجامعة إن ذكرها الطالب أو null.
- "isGreetingOnly": true فقط إذا كانت الرسالة مجرد تحية بدون طلب مادة أو مساق.`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(
        apiKey
      )}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1,
          },
        }),
        cache: "no-store",
      }
    );

    if (!res.ok) return fallback;
    const data = await res.json();
    const rawJson = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawJson) return fallback;
    const parsed = JSON.parse(rawJson);
    return {
      keywords: Array.isArray(parsed.keywords) && parsed.keywords.length > 0 ? parsed.keywords : fallback.keywords,
      courseCode: parsed.courseCode || fallback.courseCode,
      type: ["exam", "summary", "file", "video"].includes(parsed.type) ? parsed.type : null,
      university: parsed.university || null,
      isGreetingOnly: Boolean(parsed.isGreetingOnly),
    };
  } catch {
    return fallback;
  }
}

export interface BotSearchResult {
  id: string;
  title_ar: string;
  type: MaterialType;
  academic_year: string | null;
  course_name: string;
  course_code: string | null;
  university_name: string;
  directDownloadUrl: string;
}

/**
 * يبحث في فهرس ملفات المنصة (المرتبط بـ Google Drive) عن أفضل المواد المطابقة لطلب الطالب،
 * ويولّد لكل مادة رابط تنزيل مباشر (/api/dl/{id}) ينزّل الملف فورًا على الجهاز دون فتح مجلد Drive.
 */
export async function searchMaterialsForWhatsAppBot(
  userMessage: string,
  baseUrl: string
): Promise<{ replyText: string; results: BotSearchResult[] }> {
  const cleanBase = baseUrl.replace(/\/+$/, "");
  const analysis = await analyzeStudentRequestWithGemini(userMessage);

  if (analysis.isGreetingOnly) {
    return {
      results: [],
      replyText:
        "أهلاً بك في بوت منصة *PUSH* لطلبة الجامعات الفلسطينية! 📚\n\n" +
        "أرسل لي *اسم المساق* أو *رقمه* (مثال: `امتحانات دوائر كهربائية 4106` أو `ملخص تفاضل وتكامل 1`) وسأبحث لك في مستودع الملفات وأرسل لك رابط تنزيل مباشر للملف على جهازك فورًا.",
    };
  }

  // 1) البحث عن المساقات المطابقة أولًا
  const allVariants = Array.from(
    new Set([
      ...(analysis.courseCode ? [analysis.courseCode] : []),
      ...analysis.keywords.flatMap((k) => buildArabicSearchVariants(k)),
    ])
  ).filter((v) => v.length >= 2);

  let matchedCourseIds: string[] = [];
  if (allVariants.length > 0) {
    const courseOr = allVariants
      .flatMap((v) => [`name_ar.ilike.%${v}%`, `code.ilike.%${v}%`])
      .join(",");
    const { data: courses } = await supabaseAdmin
      .from("courses")
      .select("id")
      .or(courseOr)
      .limit(40);
    matchedCourseIds = (courses ?? []).map((c: { id: string }) => c.id);
  }

  // 2) البحث في جدول المواد (materials)
  let query = supabaseAdmin
    .from("materials")
    .select(
      `id, title_ar, description_ar, type, academic_year, drive_link, youtube_id,
       courses:course_id!inner ( name_ar, code, universities:university_id ( name_ar ) )`
    )
    .order("downloads_count", { ascending: false })
    .limit(6);

  if (analysis.type) {
    query = query.eq("type", analysis.type);
  }

  if (allVariants.length > 0) {
    const clauses = allVariants.flatMap((v) => [
      `title_ar.ilike.%${v}%`,
      `description_ar.ilike.%${v}%`,
    ]);
    if (matchedCourseIds.length > 0) {
      clauses.push(`course_id.in.(${matchedCourseIds.join(",")})`);
    }
    query = query.or(clauses.join(","));
  }

  const { data: rows } = await query;

  const results: BotSearchResult[] = (rows ?? []).map((r: any) => ({
    id: r.id,
    title_ar: r.title_ar,
    type: r.type as MaterialType,
    academic_year: r.academic_year,
    course_name: r.courses?.name_ar ?? "",
    course_code: r.courses?.code ?? null,
    university_name: r.courses?.universities?.name_ar ?? "",
    // رابط تنزيل مباشر ينزّل الملف فورًا على جهاز الطالب ولا يفتح مجلد Google Drive!
    directDownloadUrl: `${cleanBase}/api/dl/${r.id}`,
  }));

  if (results.length === 0) {
    return {
      results: [],
      replyText:
        `لم أجد ملفات مطابقة لـ «*${userMessage.trim()}*» في المستودع حاليًا. 🔍\n\n` +
        "جرّب البحث بـ *رقم المساق* (مثل `4106` أو `4002`) أو كتابة اسم المساق بدون همزات، أو تصفح المكتبة الكاملة عبر:\n" +
        `${cleanBase}/browse`,
    };
  }

  const lines = [
    `وجدتُ لك *${results.length}* ملفات مطابقة لطلبك في مستودع *PUSH* (اضغط على الرابط لتنزيل الملف مباشرة على جهازك):\n`,
  ];

  results.forEach((item, index) => {
    const typeLabel = MATERIAL_TYPE_LABELS[item.type] || "ملف";
    const codePart = item.course_code ? ` (${item.course_code})` : "";
    const yearPart = item.academic_year ? ` · ${item.academic_year}` : "";
    lines.push(
      `*${index + 1}. ${item.title_ar}*\n` +
        `📘 ${item.course_name}${codePart} — ${typeLabel}${yearPart}\n` +
        `⬇️ *تنزيل مباشر:* ${item.directDownloadUrl}\n`
    );
  });

  return {
    results,
    replyText: lines.join("\n"),
  };
}
