// تنظيف مسار التحويل بعد تسجيل الدخول (آمن للمتصفح والسيرفر).
// يقبل فقط مسارات داخلية نسبية؛ يرفض //evil.com و /\evil.com و javascript: وما شابه
// (المتصفحات تعامل \ كأنها / فيتحول /\evil.com إلى رابط خارجي).
export function sanitizeNextPath(raw: string | null | undefined): string {
  if (!raw) return "/";
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return "/";
  if (/[\\\u0000-\u001f\u007f]/.test(trimmed)) return "/";
  try {
    const base = "http://push.invalid";
    const url = new URL(trimmed, base);
    if (url.origin !== base) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}
