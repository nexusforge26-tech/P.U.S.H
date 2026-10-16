import { isValidStoredPhone, normalizePhone } from "./phone";

// منطق اكتمال الملف الشخصي — مشترك بين المتصفح (نافذة الإكمال الإجباري) والسيرفر (حماية الـ API).
// لا يستورد أي شيء من السيرفر ليبقى آمنًا للاستخدام في المتصفح.

export const MIN_FULL_NAME_LENGTH = 2;
export const MAX_FULL_NAME_LENGTH = 100;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ProfileContactFields {
  full_name?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  university_id?: string | null;
}

/** الملف مكتمل فقط إذا وُجدت الحقول الأربعة بقيم صالحة. */
export function isProfileComplete(profile: ProfileContactFields | null | undefined): boolean {
  if (!profile) return false;
  const name = typeof profile.full_name === "string" ? profile.full_name.trim() : "";
  if (name.length < MIN_FULL_NAME_LENGTH) return false;
  if (!isValidStoredPhone(profile.phone)) return false;
  if (!isValidStoredPhone(profile.whatsapp)) return false;
  if (typeof profile.university_id !== "string" || !UUID_REGEX.test(profile.university_id)) return false;
  return true;
}

export type ProfileFieldErrors = Partial<
  Record<"full_name" | "phone" | "whatsapp" | "university_id", string>
>;

export type ProfileValidation =
  | {
      valid: true;
      values: { full_name: string; phone: string; whatsapp: string; university_id: string };
    }
  | { valid: false; errors: ProfileFieldErrors };

export function validateFullName(raw: unknown): { ok: true; value: string } | { ok: false; error: string } {
  const value = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
  if (!value) return { ok: false, error: "الاسم مطلوب" };
  if (value.length < MIN_FULL_NAME_LENGTH) return { ok: false, error: "الاسم قصير جدًا" };
  if (value.length > MAX_FULL_NAME_LENGTH) {
    return { ok: false, error: `الاسم يجب ألا يتجاوز ${MAX_FULL_NAME_LENGTH} حرفًا` };
  }
  if (!/\p{L}/u.test(value)) return { ok: false, error: "الاسم يجب أن يحتوي على أحرف" };
  return { ok: true, value };
}

function validateStoredPhoneInput(raw: unknown, requiredMsg: string): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof raw !== "string" || !raw.trim()) return { ok: false, error: requiredMsg };
  const trimmed = raw.trim();
  // السيرفر يقبل فقط الصيغة الدولية الكاملة (+970...) كي لا يُخمَّن مفتاح الدولة.
  if (!trimmed.startsWith("+")) return { ok: false, error: "الرقم يجب أن يبدأ بمفتاح الدولة (+)" };
  const res = normalizePhone("", trimmed);
  if (!res.valid) return { ok: false, error: res.error };
  return { ok: true, value: res.e164 };
}

/**
 * يتحقق من مدخلات النموذج كما يصل للسيرفر: phone و whatsapp بصيغة دولية (+970...).
 * التحقق من وجود الجامعة في قاعدة البيانات يتم في الـ API.
 */
export function validateProfileInput(input: {
  full_name?: unknown;
  phone?: unknown;
  whatsapp?: unknown;
  university_id?: unknown;
}): ProfileValidation {
  const errors: ProfileFieldErrors = {};

  const name = validateFullName(input.full_name);
  if (!name.ok) errors.full_name = name.error;

  const phone = validateStoredPhoneInput(input.phone, "رقم الهاتف مطلوب");
  if (!phone.ok) errors.phone = phone.error;

  const whatsapp = validateStoredPhoneInput(input.whatsapp, "رقم الواتساب مطلوب");
  if (!whatsapp.ok) errors.whatsapp = whatsapp.error;

  const uni = typeof input.university_id === "string" ? input.university_id.trim() : "";
  if (!uni) errors.university_id = "اختر جامعتك من القائمة";
  else if (!UUID_REGEX.test(uni)) errors.university_id = "الجامعة المختارة غير صالحة";

  if (Object.keys(errors).length > 0 || !name.ok || !phone.ok || !whatsapp.ok) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    values: {
      full_name: name.value,
      phone: phone.value,
      whatsapp: whatsapp.value,
      university_id: uni,
    },
  };
}
