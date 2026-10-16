"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import ProfileForm from "@/components/ProfileForm";
import { getUniversities } from "@/lib/data";
import type { University } from "@/lib/types";

// قسم "بياناتي" في صفحة الحساب لتعديل الاسم والهاتف والواتساب والجامعة بعد التسجيل.
export default function ProfileEditor() {
  const { profile } = useAuth();
  const [universities, setUniversities] = useState<University[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getUniversities()
      .then(setUniversities)
      .catch(() => setUniversities([]));
  }, []);

  if (!profile) return null;

  return (
    <section className="mt-7 rounded-[28px] border border-olive/10 bg-white p-6 shadow-card">
      <h2 className="font-display text-2xl font-bold text-olive-dark">بياناتي</h2>
      <p className="mt-1 text-sm text-ink/45">
        هذه البيانات إلزامية ولا تظهر للزوار، ويطّلع عليها مسؤولو المنصة فقط.
      </p>
      <div className="mt-5 max-w-lg">
        <ProfileForm
          key={`${profile.phone}-${profile.whatsapp}-${profile.university_id}-${profile.full_name}`}
          universities={universities}
          initial={profile}
          submitLabel="حفظ التعديلات"
          onSaved={() => setSaved(true)}
        />
        {saved && (
          <p className="mt-3 rounded-2xl bg-olive/5 p-3 text-sm font-bold text-olive-dark">
            تم حفظ بياناتك ✓
          </p>
        )}
      </div>
    </section>
  );
}
