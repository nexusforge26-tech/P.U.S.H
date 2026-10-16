// أدوات أرقام الهواتف: كل رقم يُخزَّن بصيغة دولية موحّدة (E.164) مثل +970599123456
// هذا الملف آمن للاستخدام في المتصفح والسيرفر (لا يستورد أي شيء).

export interface CountryDial {
  /** مفتاح الدولة بدون + مثل 970 */
  dial: string;
  /** الاسم الظاهر في القائمة */
  label: string;
}

export const DEFAULT_DIAL = "970";

export const COUNTRY_DIALS: CountryDial[] = [
  { dial: "970", label: "فلسطين (+970)" },
  { dial: "972", label: "فلسطين (+972)" },
  { dial: "962", label: "الأردن (+962)" },
  { dial: "20", label: "مصر (+20)" },
  { dial: "966", label: "السعودية (+966)" },
  { dial: "971", label: "الإمارات (+971)" },
  { dial: "965", label: "الكويت (+965)" },
  { dial: "974", label: "قطر (+974)" },
  { dial: "973", label: "البحرين (+973)" },
  { dial: "968", label: "عُمان (+968)" },
  { dial: "961", label: "لبنان (+961)" },
  { dial: "963", label: "سوريا (+963)" },
  { dial: "964", label: "العراق (+964)" },
  { dial: "967", label: "اليمن (+967)" },
  { dial: "218", label: "ليبيا (+218)" },
  { dial: "216", label: "تونس (+216)" },
  { dial: "213", label: "الجزائر (+213)" },
  { dial: "212", label: "المغرب (+212)" },
  { dial: "249", label: "السودان (+249)" },
  { dial: "90", label: "تركيا (+90)" },
  { dial: "44", label: "المملكة المتحدة (+44)" },
  { dial: "49", label: "ألمانيا (+49)" },
  { dial: "33", label: "فرنسا (+33)" },
  { dial: "1", label: "أمريكا وكندا (+1)" },
  { dial: "61", label: "أستراليا (+61)" },
  { dial: "60", label: "ماليزيا (+60)" },
];

const KNOWN_DIALS = new Set(COUNTRY_DIALS.map((c) => c.dial));
// للمطابقة بأطول مفتاح أولًا (مثلًا 970 قبل 9 أو 97)
const DIALS_LONGEST_FIRST = [...KNOWN_DIALS].sort((a, b) => b.length - a.length);

const E164_REGEX = /^\+[1-9]\d{7,14}$/;

/** يحوّل الأرقام العربية والفارسية إلى لاتينية ويحذف المسافات والرموز المعتادة. */
function cleanDigits(raw: string): string {
  return raw
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[\s\-().\u200e\u200f]/g, "");
}

export type PhoneResult =
  | { valid: true; e164: string; dial: string; local: string }
  | { valid: false; error: string };

/**
 * يتحقق من رقم (مفتاح الدولة + الرقم المحلي) ويرجع الصيغة الدولية الموحّدة.
 * - يقبل أرقامًا عربية ومسافات وشرطات.
 * - يحذف الصفر البادئ من الرقم المحلي (0599... → 599...).
 * - إذا كتب المستخدم الرقم كاملًا بصيغة +970... أو 00970... يتعرّف على المفتاح تلقائيًا.
 */
export function normalizePhone(dial: string, localRaw: string): PhoneResult {
  let dialDigits = typeof dial === "string" ? dial.replace(/\D/g, "") : "";
  let local = typeof localRaw === "string" ? cleanDigits(localRaw) : "";

  if (!local) return { valid: false, error: "الرقم مطلوب" };

  // رقم كُتب كاملًا بصيغة دولية
  if (local.startsWith("+") || local.startsWith("00")) {
    const digits = local.replace(/^(\+|00)/, "");
    if (!/^\d+$/.test(digits)) return { valid: false, error: "الرقم يجب أن يحتوي على أرقام فقط" };
    const found = DIALS_LONGEST_FIRST.find((d) => digits.startsWith(d));
    if (!found) return { valid: false, error: "مفتاح الدولة غير مدعوم، اختره من القائمة" };
    dialDigits = found;
    local = digits.slice(found.length);
  }

  if (!KNOWN_DIALS.has(dialDigits)) {
    return { valid: false, error: "اختر مفتاح الدولة من القائمة" };
  }
  if (!/^\d+$/.test(local)) {
    return { valid: false, error: "الرقم يجب أن يحتوي على أرقام فقط" };
  }

  local = local.replace(/^0+/, "");

  if (dialDigits === "970" || dialDigits === "972") {
    if (local.length < 8 || local.length > 9) {
      return { valid: false, error: "الرقم غير صحيح، مثال: 599123456" };
    }
  } else if (local.length < 6 || local.length > 12) {
    return { valid: false, error: "الرقم غير صحيح، تأكد من عدد الخانات" };
  }

  const e164 = `+${dialDigits}${local}`;
  if (!E164_REGEX.test(e164)) {
    return { valid: false, error: "الرقم غير صحيح، تأكد من عدد الخانات" };
  }
  return { valid: true, e164, dial: dialDigits, local };
}

/** يفصل رقمًا مخزّنًا (E.164) إلى مفتاح الدولة والرقم المحلي لعرضه في النموذج. */
export function splitE164(value: string | null | undefined): { dial: string; local: string } {
  if (typeof value !== "string" || !value.startsWith("+")) {
    return { dial: DEFAULT_DIAL, local: "" };
  }
  const digits = value.slice(1).replace(/\D/g, "");
  const found = DIALS_LONGEST_FIRST.find((d) => digits.startsWith(d));
  if (!found) return { dial: DEFAULT_DIAL, local: "" };
  return { dial: found, local: digits.slice(found.length) };
}

/** هل القيمة المخزّنة رقم دولي صالح؟ (تستخدم نفس قواعد normalizePhone). */
export function isValidStoredPhone(value: string | null | undefined): boolean {
  if (typeof value !== "string" || !E164_REGEX.test(value)) return false;
  const { dial, local } = splitE164(value);
  if (!local) return false;
  const res = normalizePhone(dial, local);
  return res.valid && res.e164 === value;
}

/** رابط واتساب مباشر من رقم دولي مخزّن. */
export function whatsappLink(value: string | null | undefined): string | null {
  if (!isValidStoredPhone(value)) return null;
  return `https://wa.me/${(value as string).slice(1)}`;
}
