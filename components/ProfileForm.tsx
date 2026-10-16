"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { authFetch } from "@/lib/authFetch";
import { COUNTRY_DIALS, normalizePhone, splitE164 } from "@/lib/phone";
import { validateFullName, type ProfileFieldErrors } from "@/lib/profile";
import { INPUT_CLASS, SELECT_CLASS } from "@/lib/styles";
import type { UserProfile } from "@/lib/auth";
import type { University } from "@/lib/types";

interface Props {
  universities: University[];
  initial?: Partial<Pick<UserProfile, "full_name" | "phone" | "whatsapp" | "university_id">> | null;
  submitLabel?: string;
  onSaved?: () => void;
}

function PhoneField({
  id,
  dial,
  local,
  onDial,
  onLocal,
  disabled,
  error,
}: {
  id: string;
  dial: string;
  local: string;
  onDial: (v: string) => void;
  onLocal: (v: string) => void;
  disabled?: boolean;
  error?: string;
}) {
  return (
    <>
      <div dir="ltr" className="flex gap-2">
        <select
          aria-label="مفتاح الدولة"
          value={dial}
          onChange={(e) => onDial(e.target.value)}
          disabled={disabled}
          className={`${SELECT_CLASS} !w-auto max-w-[48%] shrink-0`}
        >
          {COUNTRY_DIALS.map((c) => (
            <option key={c.dial + c.label} value={c.dial}>
              {c.label}
            </option>
          ))}
        </select>
        <input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          dir="ltr"
          maxLength={20}
          value={local}
          onChange={(e) => onLocal(e.target.value)}
          disabled={disabled}
          placeholder="599123456"
          className={`${INPUT_CLASS} text-left disabled:cursor-not-allowed disabled:bg-ink/5`}
        />
      </div>
      {error && <p className="mt-1.5 text-xs font-bold text-clay-dark">{error}</p>}
    </>
  );
}

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-black text-olive-dark">
      {children} <span className="text-clay">*</span>
    </label>
  );
}

export default function ProfileForm({ universities, initial, submitLabel = "حفظ ومتابعة", onSaved }: Props) {
  const { refreshProfile } = useAuth();

  const initPhone = splitE164(initial?.phone);
  const initWa = splitE164(initial?.whatsapp);

  const [fullName, setFullName] = useState(initial?.full_name ?? "");
  const [phoneDial, setPhoneDial] = useState(initPhone.dial);
  const [phoneLocal, setPhoneLocal] = useState(initPhone.local);
  const [waDial, setWaDial] = useState(initWa.dial);
  const [waLocal, setWaLocal] = useState(initWa.local);
  const [sameAsPhone, setSameAsPhone] = useState(
    Boolean(initial?.phone) && initial?.phone === initial?.whatsapp
  );
  const [universityId, setUniversityId] = useState(initial?.university_id ?? "");
  const [errors, setErrors] = useState<ProfileFieldErrors>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setFormError("");

    const next: ProfileFieldErrors = {};

    const name = validateFullName(fullName);
    if (!name.ok) next.full_name = name.error;

    const phone = normalizePhone(phoneDial, phoneLocal);
    if (!phone.valid) next.phone = phone.error;

    const wa = sameAsPhone ? phone : normalizePhone(waDial, waLocal);
    if (!wa.valid) next.whatsapp = wa.error;

    if (!universityId) next.university_id = "اختر جامعتك من القائمة";

    setErrors(next);
    if (Object.keys(next).length > 0 || !name.ok || !phone.valid || !wa.valid) return;

    setBusy(true);
    try {
      const res = await authFetch("/api/profile", {
        method: "PUT",
        body: JSON.stringify({
          full_name: name.value,
          phone: phone.e164,
          whatsapp: wa.e164,
          university_id: universityId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data?.fields) setErrors(data.fields as ProfileFieldErrors);
        setFormError(data?.error || "تعذر حفظ البيانات");
        return;
      }
      await refreshProfile();
      onSaved?.();
    } catch {
      setFormError("تعذر الاتصال بالخادم، تحقق من الإنترنت وحاول مرة أخرى.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5 text-right">
      <div>
        <Label htmlFor="pf-name">الاسم</Label>
        <input
          id="pf-name"
          type="text"
          autoComplete="name"
          maxLength={100}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="الاسم الكامل"
          className={INPUT_CLASS}
        />
        {errors.full_name && <p className="mt-1.5 text-xs font-bold text-clay-dark">{errors.full_name}</p>}
      </div>

      <div>
        <Label htmlFor="pf-phone">رقم الهاتف (مع مفتاح الدولة)</Label>
        <PhoneField
          id="pf-phone"
          dial={phoneDial}
          local={phoneLocal}
          onDial={setPhoneDial}
          onLocal={setPhoneLocal}
          error={errors.phone}
        />
      </div>

      <div>
        <Label htmlFor="pf-wa">رقم الواتساب (مع مفتاح الدولة)</Label>
        <PhoneField
          id="pf-wa"
          dial={sameAsPhone ? phoneDial : waDial}
          local={sameAsPhone ? phoneLocal : waLocal}
          onDial={setWaDial}
          onLocal={setWaLocal}
          disabled={sameAsPhone}
          error={errors.whatsapp}
        />
        <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs font-bold text-ink/60">
          <input
            type="checkbox"
            checked={sameAsPhone}
            onChange={(e) => setSameAsPhone(e.target.checked)}
            className="h-4 w-4 accent-[#2F3D2A]"
          />
          رقم الواتساب هو نفس رقم الهاتف
        </label>
      </div>

      <div>
        <Label htmlFor="pf-uni">الجامعة</Label>
        <select
          id="pf-uni"
          value={universityId}
          onChange={(e) => setUniversityId(e.target.value)}
          className={SELECT_CLASS}
        >
          <option value="">— اختر جامعتك —</option>
          {universities.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name_ar}
            </option>
          ))}
        </select>
        {errors.university_id && (
          <p className="mt-1.5 text-xs font-bold text-clay-dark">{errors.university_id}</p>
        )}
      </div>

      {formError && (
        <p role="alert" className="rounded-2xl bg-clay/5 p-3 text-sm font-bold text-clay-dark">
          {formError}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-2xl bg-olive px-5 py-3.5 font-black text-parchment shadow-card transition hover:-translate-y-0.5 disabled:opacity-60"
      >
        {busy ? "جارٍ الحفظ..." : submitLabel}
      </button>
    </form>
  );
}
