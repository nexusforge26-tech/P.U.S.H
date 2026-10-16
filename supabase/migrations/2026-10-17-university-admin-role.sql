-- ============================================================
-- دور جديد: «مسؤول (اسم الجامعة)» = uni_admin
--  * يرى فقط أعضاء جامعته وطلباتها (مساهمات، دكاترة، بلاغات، سجل) ويدير محتواها.
--  * لا يعدّل صلاحيات أي مسؤول آخر ولا يحذف حسابات.
--  * المالك والمسؤول العادي (admin) يرون كل الجامعات؛ والمسؤول العادي لا صلاحية له على المالك.
-- آمن للتشغيل أكثر من مرة (idempotent).
-- ============================================================

-- 1) السماح بالدور الجديد
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('user','uni_admin','admin','owner'));

-- 2) الجامعة التي يديرها مسؤول الجامعة.
--    عمود مستقل عن university_id (الذي يختاره الطالب بنفسه) حتى لا يستطيع توسيع نطاقه بتغيير جامعته.
--    يُكتب حصريًا من /api/admin/users بمفتاح service_role.
alter table public.profiles
  add column if not exists managed_university_id uuid references public.universities(id) on delete set null;
create index if not exists idx_profiles_managed_university on public.profiles(managed_university_id);

-- مسؤول جامعة بلا جامعة (مثلًا بعد حذف جامعته) = لا صلاحية في الواجهة والـ API.

-- 3) ربط سجل النشاط بالجامعة ليرى مسؤول الجامعة سجل جامعته فقط
alter table public.activity_log
  add column if not exists university_id uuid references public.universities(id) on delete set null;
create index if not exists idx_activity_log_university on public.activity_log(university_id, created_at desc);

-- تعبئة السجلات القديمة قدر الإمكان: من المساق، ثم من جامعة المنفِّذ
update public.activity_log al
set university_id = c.university_id
from public.courses c
where al.university_id is null and al.course_id = c.id;

update public.activity_log al
set university_id = p.university_id
from public.profiles p
where al.university_id is null and al.actor_id = p.id;

comment on column public.profiles.managed_university_id is
  'الجامعة التي يديرها مسؤول الجامعة (role = uni_admin). NULL لبقية الأدوار.';
