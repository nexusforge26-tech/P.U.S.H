-- ============================================================
-- بيانات إلزامية للحساب: الهاتف، الواتساب، الجامعة (بجانب الاسم)
-- آمن للتشغيل أكثر من مرة (idempotent).
-- الحسابات القديمة ستحصل على قيم NULL، وسيظهر لها نموذج الإكمال الإجباري عند الدخول.
-- ============================================================

alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists whatsapp text;

-- عند حذف جامعة من لوحة الإدارة يُفرَّغ الحقل، ويُطلب من الطلاب المرتبطين بها اختيار جامعة أخرى.
alter table public.profiles
  add column if not exists university_id uuid references public.universities(id) on delete set null;

create index if not exists idx_profiles_university on public.profiles(university_id);

-- حماية على مستوى القاعدة: الأرقام تُخزَّن بصيغة دولية فقط (+970599123456)
alter table public.profiles drop constraint if exists profiles_phone_e164_chk;
alter table public.profiles
  add constraint profiles_phone_e164_chk check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$');

alter table public.profiles drop constraint if exists profiles_whatsapp_e164_chk;
alter table public.profiles
  add constraint profiles_whatsapp_e164_chk check (whatsapp is null or whatsapp ~ '^\+[1-9][0-9]{7,14}$');

comment on column public.profiles.phone is 'رقم الهاتف بصيغة دولية E.164 — خاص: يقرأه صاحب الحساب والمسؤولون فقط';
comment on column public.profiles.whatsapp is 'رقم الواتساب بصيغة دولية E.164 — خاص: يقرأه صاحب الحساب والمسؤولون فقط';

-- لا حاجة لسياسات RLS جديدة:
--  * القراءة: سياسة "users read own profile" الحالية (id = auth.uid()) تغطي الأعمدة الجديدة.
--  * الكتابة: لا توجد سياسة تعديل للمستخدمين، والحفظ يتم حصريًا عبر /api/profile بمفتاح service_role.
