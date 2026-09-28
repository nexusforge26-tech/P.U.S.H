-- PUSH — schema + authentication/roles/submissions
create extension if not exists "pgcrypto";
create extension if not exists pg_trgm;

create table if not exists universities (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null,
  created_at timestamptz not null default now()
);
create table if not exists faculties (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references universities(id) on delete cascade,
  name_ar text not null,
  created_at timestamptz not null default now()
);
create table if not exists courses (
  id uuid primary key default gen_random_uuid(),
  faculty_id uuid not null references faculties(id) on delete cascade,
  name_ar text not null,
  code text,
  created_at timestamptz not null default now()
);
create table if not exists materials (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  title_ar text not null,
  description_ar text,
  type text not null check (type in ('exam', 'summary', 'file', 'video')),
  academic_year text,
  semester text,
  drive_link text,
  youtube_id text,
  is_featured boolean not null default false,
  downloads_count integer not null default 0,
  created_at timestamptz not null default now(),
  constraint material_has_source check ((type = 'video' and youtube_id is not null) or (type <> 'video' and drive_link is not null))
);
create index if not exists idx_faculties_university on faculties(university_id);
create index if not exists idx_courses_faculty on courses(faculty_id);
create index if not exists idx_materials_course on materials(course_id);
create index if not exists idx_materials_type on materials(type);
create index if not exists idx_materials_featured on materials(is_featured);
create index if not exists idx_materials_title_trgm on materials using gin (title_ar gin_trgm_ops);

-- Accounts and roles. New accounts are regular users by default.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  role text not null default 'user' check (role in ('user','admin','owner')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_profiles_role on profiles(role);
create index if not exists idx_profiles_email on profiles(email);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles(id,email,full_name,avatar_url,role)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url',
    case when lower(new.email) = lower('ydha957@gmail.com') then 'owner' else 'user' end
  )
  on conflict (id) do update set email=excluded.email, full_name=coalesce(excluded.full_name,profiles.full_name), avatar_url=coalesce(excluded.avatar_url,profiles.avatar_url);
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Backfill profiles for accounts that already exist. The owner email is always owner.
insert into public.profiles(id,email,full_name,avatar_url,role)
select id, lower(email), coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name'), raw_user_meta_data->>'avatar_url',
       case when lower(email)=lower('ydha957@gmail.com') then 'owner' else 'user' end
from auth.users
on conflict (id) do update set email=excluded.email, role=case when lower(excluded.email)=lower('ydha957@gmail.com') then 'owner' else profiles.role end;

create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  title_ar text not null,
  description_ar text,
  type text not null check (type in ('exam','summary','file','video')),
  academic_year text,
  semester text,
  drive_link text,
  youtube_id text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint submission_has_source check ((type='video' and youtube_id is not null) or (type<>'video' and drive_link is not null))
);
create index if not exists idx_submissions_user on submissions(user_id);
create index if not exists idx_submissions_status on submissions(status);
create index if not exists idx_submissions_created on submissions(created_at desc);

-- api/admin/submissions embeds the submitter's profile as
-- `profiles:user_id(email,full_name)`. PostgREST can only auto-embed two
-- tables that have a direct foreign key between them — submissions.user_id
-- referencing auth.users(id) is not enough, since profiles.id references
-- auth.users(id) separately, with no FK from submissions to profiles itself.
-- Without this constraint the admin "المساهمات المعلقة" query fails and no
-- pending submission ever reaches the dashboard. Safe to re-run.
alter table submissions drop constraint if exists submissions_user_id_fkey;
alter table submissions add constraint submissions_user_id_fkey
  foreign key (user_id) references profiles(id) on delete cascade;

alter table universities enable row level security;
alter table faculties enable row level security;
alter table courses enable row level security;
alter table materials enable row level security;
alter table profiles enable row level security;
alter table submissions enable row level security;

drop policy if exists "public read universities" on universities;
drop policy if exists "public read faculties" on faculties;
drop policy if exists "public read courses" on courses;
drop policy if exists "public read materials" on materials;
create policy "public read universities" on universities for select using (true);
create policy "public read faculties" on faculties for select using (true);
create policy "public read courses" on courses for select using (true);
create policy "public read materials" on materials for select using (true);

drop policy if exists "users read own profile" on profiles;
create policy "users read own profile" on profiles for select to authenticated using (id = auth.uid());

drop policy if exists "users create own submissions" on submissions;
drop policy if exists "users read own submissions" on submissions;
create policy "users create own submissions" on submissions for insert to authenticated with check (user_id = auth.uid());
create policy "users read own submissions" on submissions for select to authenticated using (user_id = auth.uid());

create or replace function increment_downloads(material_id uuid)
returns void language sql security definer set search_path = public as $$
  update materials set downloads_count = downloads_count + 1 where id = material_id;
$$;
grant execute on function increment_downloads(uuid) to anon, authenticated;

-- ===========================================================================
-- تحديث: تصفح متسلسل، اقتراح مساقات، تعديل/حذف خلال 6 ساعات، وسجل المنشورات.
-- الملف كامل قابل لإعادة التنفيذ بأمان (idempotent) — نفّذه كاملاً من جديد.
-- ===========================================================================

-- من نشر كل مادة (يُستخدم للسماح لصاحب المادة بتعديلها/حذفها خلال 6 ساعات).
alter table materials add column if not exists created_by uuid references auth.users(id) on delete set null;
create index if not exists idx_materials_created_by on materials(created_by);

-- السماح للمساهمات بأن تكون "مساق جديد مقترح" وليس فقط "مادة لمساق موجود".
alter table submissions alter column course_id drop not null;
alter table submissions add column if not exists kind text not null default 'material' check (kind in ('material','course'));
alter table submissions add column if not exists suggested_course_name text;
alter table submissions add column if not exists suggested_course_code text;
alter table submissions add column if not exists suggested_faculty_id uuid references faculties(id) on delete cascade;
alter table submissions drop constraint if exists submission_course_or_material_check;
alter table submissions add constraint submission_course_or_material_check check (
  (kind = 'material' and course_id is not null) or
  (kind = 'course' and suggested_course_name is not null and suggested_course_code is not null and suggested_faculty_id is not null)
);

-- سجل المنشورات: من أضاف/نشر ماذا ومتى. يظهر فقط للمسؤول والمالك.
create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  actor_name text,
  actor_email text,
  action text not null,
  target_type text not null,
  target_id uuid,
  title_ar text,
  course_id uuid references courses(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_activity_log_created on activity_log(created_at desc);
create index if not exists idx_activity_log_actor on activity_log(actor_id);
alter table activity_log enable row level security;
drop policy if exists "staff read activity log" on activity_log;
create policy "staff read activity log" on activity_log for select to authenticated using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin','owner'))
);
-- لا حاجة لسياسة إدخال: كل الإدراجات تتم عبر مفتاح الخدمة (service role) من الـ API فقط.

-- ===========================================================================
-- تحديث: معلومات الدكاترة — نشر بموافقة المسؤول، وتعديل بيانات دكتور موجود
-- (بموافقة المسؤول أيضًا) مع عرض الفرق بين القديم والمقترح. الملف كامل
-- قابل لإعادة التنفيذ بأمان (idempotent) — نفّذه كاملاً من جديد.
-- ===========================================================================

-- بيانات الدكاترة المعتمدة (تظهر للجميع بعد الموافقة).
create table if not exists doctors (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text,
  office_location text,
  university_id uuid not null references universities(id) on delete cascade,
  faculty_id uuid not null references faculties(id) on delete cascade,
  courses text[] not null default '{}',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_doctors_university on doctors(university_id);
create index if not exists idx_doctors_faculty on doctors(faculty_id);
create index if not exists idx_doctors_name_trgm on doctors using gin (full_name gin_trgm_ops);

-- مساهمات معلومات الدكاترة: إما "دكتور جديد" (kind='new') أو "تعديل دكتور
-- موجود" (kind='edit', ويشير target_doctor_id إلى السجل المطلوب تعديله حتى
-- تستطيع لوحة الإدارة عرض القديم بجانب المقترح والفرق بينهما). كلا النوعين
-- يبقى معلّقًا حتى موافقة المسؤول، تمامًا كمساهمات المواد.
create table if not exists doctor_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'new' check (kind in ('new','edit')),
  target_doctor_id uuid references doctors(id) on delete set null,
  full_name text not null,
  email text not null,
  phone text,
  office_location text,
  university_id uuid not null references universities(id) on delete cascade,
  faculty_id uuid not null references faculties(id) on delete cascade,
  courses text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  -- يُشترط وجود target_doctor_id فقط طالما الطلب لا يزال معلّقًا؛ إذا حُذف
  -- الدكتور لاحقًا (target_doctor_id يصبح null تلقائيًا) لا ينبغي أن يفشل ذلك
  -- على سجلات المساهمات القديمة المُراجَعة فعلاً.
  constraint doctor_submission_edit_needs_target check (status <> 'pending' or kind = 'new' or target_doctor_id is not null)
);
create index if not exists idx_doctor_submissions_user on doctor_submissions(user_id);
create index if not exists idx_doctor_submissions_status on doctor_submissions(status);
create index if not exists idx_doctor_submissions_target on doctor_submissions(target_doctor_id);
create index if not exists idx_doctor_submissions_created on doctor_submissions(created_at desc);

-- نفس سبب قيد المفتاح الأجنبي الموجود أعلاه على submissions: للسماح بتضمين
-- profiles:user_id مباشرة في استعلام لوحة الإدارة.
alter table doctor_submissions drop constraint if exists doctor_submissions_user_id_fkey;
alter table doctor_submissions add constraint doctor_submissions_user_id_fkey
  foreign key (user_id) references profiles(id) on delete cascade;

alter table doctors enable row level security;
alter table doctor_submissions enable row level security;

drop policy if exists "public read doctors" on doctors;
create policy "public read doctors" on doctors for select using (true);

drop policy if exists "users create own doctor submissions" on doctor_submissions;
drop policy if exists "users read own doctor submissions" on doctor_submissions;
create policy "users create own doctor submissions" on doctor_submissions for insert to authenticated with check (user_id = auth.uid());
create policy "users read own doctor submissions" on doctor_submissions for select to authenticated using (user_id = auth.uid());
-- لا حاجة لسياسة إدخال/تعديل على doctors نفسها: يتم إنشاؤها وتحديثها فقط
-- عبر مفتاح الخدمة (service role) عند موافقة المسؤول على مساهمة.

-- ===========================================================================
-- تحديث: إجراءات الإدارة على الأعضاء (إيقاف/إعادة تفعيل/حذف) وربط ملفات Drive
-- بمجلدات المساقات. قابل لإعادة التنفيذ بأمان.
-- ===========================================================================

-- الحساب الموقوف (suspended_at ليس فارغًا) يستطيع التصفح فقط، ولا يستطيع
-- إرسال مساهمات ولا رفع ملفات ولا تعديل منشوراته.
alter table profiles add column if not exists suspended_at timestamptz;

-- نمنع الموقوف من الإدراج حتى لو استخدم مفتاح anon مباشرة بدل الـ API.
drop policy if exists "users create own submissions" on submissions;
create policy "users create own submissions" on submissions for insert to authenticated with check (
  user_id = auth.uid()
  and not exists (select 1 from profiles p where p.id = auth.uid() and p.suspended_at is not null)
);

-- عند تنفيذ هذا الملف من جديد تتم إعادة إنشاء قيد submission_has_source
-- القديم أعلاه، لذلك نعيد القيد الصحيح (لا ينطبق على اقتراح المساقات) هنا.
alter table submissions alter column title_ar drop not null;
alter table submissions alter column type drop not null;
alter table submissions drop constraint if exists submission_has_source;
alter table submissions add constraint submission_has_source check (
  kind = 'course'
  or (type = 'video' and youtube_id is not null)
  or (type <> 'video' and drive_link is not null)
);
