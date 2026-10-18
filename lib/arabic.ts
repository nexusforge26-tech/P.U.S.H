/**
 * أدوات تطبيع النص العربي لتحسين دقة البحث ومطابقة العناوين والمساقات.
 * - إزالة التشكيل والمد (التطويل)
 * - توحيد الهمزات (أ، إ، آ، ٱ -> ا)
 * - توحيد الألف المقصورة (ى -> ي) والتاء المربوطة (ة -> ه)
 * - توحيد الهمزة على واو/ياء (ؤ -> و، ئ -> ي)
 */
export function normalizeArabic(input: string): string {
  if (!input) return "";
  return input
    .normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/[ىی]/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * ينشئ قائمة صيغ محتملة للكلمة العربية للبحث في PostgreSQL عبر ilike
 * عندما لا يكون عمود search_text المطبّع متاحًا بعد.
 */
export function buildArabicSearchVariants(rawQuery: string): string[] {
  const clean = rawQuery.replace(/[,()%*\\"]/g, " ").replace(/\s+/g, " ").trim();
  if (!clean) return [];

  const normalized = normalizeArabic(clean);
  const withTaMarbuta = normalized.replace(/ه(\b|$)/g, "ة$1");
  const withAlefMaksora = normalized.replace(/ي(\b|$)/g, "ى$1");
  const withHamzaAbove = normalized.replace(/(^|\s)ا/g, "$1أ");
  const withHamzaBelow = normalized.replace(/(^|\s)ا/g, "$1إ");

  return Array.from(
    new Set([clean, normalized, withTaMarbuta, withAlefMaksora, withHamzaAbove, withHamzaBelow].filter(Boolean))
  );
}

/**
 * يتحقق مما إذا كان النص الهدف يحتوي على نص البحث بعد التطبيع العربي.
 */
export function matchesArabicSearch(target: string | null | undefined, query: string): boolean {
  if (!target) return false;
  const normTarget = normalizeArabic(target);
  const normQuery = normalizeArabic(query);
  if (!normQuery) return true;
  return normTarget.includes(normQuery);
}
