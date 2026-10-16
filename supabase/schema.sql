-- PUSH — schema + authentication/roles/submissions/notifications/reports
-- الهيكل الحالي: جامعة ← مساق ← منشورات (لا توجد كليات).
-- هذا الملف قابل لإعادة التنفيذ بأمان (idempotent).
create extension if not exists "pgcrypto";
create extension if not exists pg_trgm;

-- دالة تطبيع النص العربي للبحث الدقيق (توحيد الهمزات، التاء المربوطة، الألف المقصورة، وإزالة التشكيل)
create or replace function public.normalize_arabic(input text)
returns text
language sql
immutable
as $$
  select lower(
    trim(
      regexp_replace(
        translate(
          regexp_replace(coalesce(input, ''), '[\u064B-\u065F\u0670\u0640]', '', 'g'),
          'أإآٱىيةؤئ',
          'ااااييهوي'
        ),
        '\s+',
        ' ',
        'g'
      )
    )
  );
$$;

-- جدول إعدادات التطبيق (بدل تثبيت بريد المالك في الكود المصدري)
create table if not exists app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table app_settings enable row level security;

create table if not exists universities (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null,
  created_at timestamptz not null default now()
);

create table if not exists courses (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references universities(id) on delete cascade,
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
  is_verified boolean not null default false,
  downloads_count integer not null default 0,
  helpful_count integer not null default 0,
  file_size bigint,
  mime_type text,
  page_count integer,
  search_text text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint material_has_source check ((type = 'video' and youtube_id is not null) or (type <> 'video' and drive_link is not null))
);

alter table materials add column if not exists is_verified boolean not null default false;
alter table materials add column if not exists helpful_count integer not null default 0;
alter table materials add column if not exists file_size bigint;
alter table materials add column if not exists mime_type text;
alter table materials add column if not exists page_count integer;
alter table materials add column if not exists search_text text;
alter table materials add column if not exists created_by uuid references auth.users(id) on delete set null;

-- تحديث تلقائي لعمود search_text المطبّع عند إدراج أو تعديل مادة
create or replace function public.materials_update_search_text()
returns trigger
language plpgsql
as $$
declare
  c_name text;
  c_code text;
begin
  select name_ar, code into c_name, c_code from public.courses where id = new.course_id;
  new.search_text := public.normalize_arabic(
    coalesce(new.title_ar, '') || ' ' ||
    coalesce(new.description_ar, '') || ' ' ||
    coalesce(c_name, '') || ' ' ||
    coalesce(c_code, '')
  );
  return new;
end;
$$;

drop trigger if exists trg_materials_search_text on materials;
create trigger trg_materials_search_text
before insert or update on materials
for each row execute function public.materials_update_search_text();

-- الفهارس الأساسية وفهارس البحث السريع (Trigram & Sorting)
create index if not exists idx_courses_university on courses(university_id);
create index if not exists idx_courses_name_trgm on courses using gin (name_ar gin_trgm_ops);
create index if not exists idx_courses_code_trgm on courses using gin (code gin_trgm_ops);

create index if not exists idx_materials_course on materials(course_id);
create index if not exists idx_materials_type on materials(type);
create index if not exists idx_materials_featured on materials(is_featured);
create index if not exists idx_materials_created_at on materials(created_at desc);
create index if not exists idx_materials_downloads on materials(downloads_count desc);
create index if not exists idx_materials_created_by on materials(created_by);
create index if not exists idx_materials_title_trgm on materials using gin (title_ar gin_trgm_ops);
create index if not exists idx_materials_search_trgm on materials using gin (search_text gin_trgm_ops);

-- الحسابات والأدوار
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  role text not null default 'user' check (role in ('user','uni_admin','admin','owner')),
  -- بيانات إلزامية يُطلب إكمالها بعد أول تسجيل دخول (أرقام بصيغة دولية E.164)
  phone text check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'),
  whatsapp text check (whatsapp is null or whatsapp ~ '^\+[1-9][0-9]{7,14}$'),
  university_id uuid references universities(id) on delete set null,
  -- الجامعة التي يديرها «مسؤول الجامعة» (uni_admin)؛ مستقلة عن university_id حتى لا يوسّع الطالب نطاقه بتغيير جامعته
  managed_university_id uuid references universities(id) on delete set null,
  -- وقت أول عرض لنافذة إكمال البيانات؛ تظهر مرة واحدة فقط لكل حساب
  profile_prompted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- للقواعد الموجودة مسبقًا (الجدول لا يُعاد إنشاؤه): الدور الجديد + العمود
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check check (role in ('user','uni_admin','admin','owner'));
alter table profiles add column if not exists managed_university_id uuid references universities(id) on delete set null;
alter table profiles add column if not exists profile_prompted_at timestamptz;
create index if not exists idx_profiles_managed_university on profiles(managed_university_id);
create index if not exists idx_profiles_role on profiles(role);
create index if not exists idx_profiles_email on profiles(email);
create index if not exists idx_profiles_university on profiles(university_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  configured_owner text;
begin
  select value into configured_owner from public.app_settings where key = 'owner_email' limit 1;
  insert into public.profiles(id,email,full_name,avatar_url,role)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url',
    case when configured_owner is not null and lower(new.email) = lower(configured_owner) then 'owner' else 'user' end
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, profiles.full_name),
    avatar_url = coalesce(excluded.avatar_url, profiles.avatar_url);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- جدول المساهمات (مع الحفاظ على أرشيف المساهمات عند حذف المستخدم عبر on delete set null)
create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,
  submitter_name text,
  submitter_email text,
  kind text not null default 'material' check (kind in ('material','course','material_edit')),
  course_id uuid references courses(id) on delete cascade,
  target_material_id uuid references materials(id) on delete cascade,
  title_ar text not null,
  description_ar text,
  type text check (type in ('exam','summary','file','video')),
  academic_year text,
  semester text,
  drive_link text,
  youtube_id text,
  file_size bigint,
  mime_type text,
  page_count integer,
  suggested_course_name text,
  suggested_course_code text,
  suggested_university_id uuid references universities(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint submission_course_or_material_check check (
    (kind = 'material' and course_id is not null and ((type = 'video' and youtube_id is not null) or (type <> 'video' and drive_link is not null))) or
    (kind = 'material_edit' and target_material_id is not null and course_id is not null) or
    (kind = 'course' and suggested_course_name is not null and suggested_course_code is not null and suggested_university_id is not null)
  )
);

alter table submissions alter column user_id drop not null;
alter table submissions alter column course_id drop not null;
alter table submissions alter column type drop not null;
alter table submissions add column if not exists submitter_name text;
alter table submissions add column if not exists submitter_email text;
alter table submissions add column if not exists kind text not null default 'material';
alter table submissions add column if not exists target_material_id uuid references materials(id) on delete cascade;
alter table submissions add column if not exists file_size bigint;
alter table submissions add column if not exists mime_type text;
alter table submissions add column if not exists page_count integer;
alter table submissions add column if not exists suggested_course_name text;
alter table submissions add column if not exists suggested_course_code text;
alter table submissions add column if not exists suggested_university_id uuid references universities(id) on delete cascade;

alter table submissions drop constraint if exists submissions_user_id_fkey;
alter table submissions add constraint submissions_user_id_fkey
  foreign key (user_id) references profiles(id) on delete set null;

create index if not exists idx_submissions_user on submissions(user_id);
create index if not exists idx_submissions_status on submissions(status);
create index if not exists idx_submissions_created on submissions(created_at desc);

-- تفعيل RLS (حذف سياسات الإدراج المباشر عبر مفتاح anon لمنع تجاوز تحققات الـ API)
alter table universities enable row level security;
alter table courses enable row level security;
alter table materials enable row level security;
alter table profiles enable row level security;
alter table submissions enable row level security;

drop policy if exists "public read universities" on universities;
drop policy if exists "public read courses" on courses;
drop policy if exists "public read materials" on materials;
create policy "public read universities" on universities for select using (true);
create policy "public read courses" on courses for select using (true);
create policy "public read materials" on materials for select using (true);

drop policy if exists "users read own profile" on profiles;
create policy "users read own profile" on profiles for select to authenticated using (id = auth.uid());

drop policy if exists "users create own submissions" on submissions;
drop policy if exists "users read own submissions" on submissions;
create policy "users read own submissions" on submissions for select to authenticated using (user_id = auth.uid());

-- دالة زيادة عداد التحميلات محصورة بـ service_role فقط لمنع التضخيم الوهمي عبر مفتاح anon
create or replace function increment_downloads(material_id uuid)
returns void language sql security definer set search_path = public as $$
  update materials set downloads_count = downloads_count + 1 where id = material_id;
$$;
revoke execute on function increment_downloads(uuid) from public, anon, authenticated;
grant execute on function increment_downloads(uuid) to service_role;

-- سجل النشاط
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
  university_id uuid references universities(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table activity_log add column if not exists university_id uuid references universities(id) on delete set null;
create index if not exists idx_activity_log_university on activity_log(university_id, created_at desc);
create index if not exists idx_activity_log_created on activity_log(created_at desc);
create index if not exists idx_activity_log_actor on activity_log(actor_id);
create index if not exists idx_activity_log_action on activity_log(action);
alter table activity_log enable row level security;
drop policy if exists "staff read activity log" on activity_log;
create policy "staff read activity log" on activity_log for select to authenticated using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin','owner'))
);

-- الدكاترة ومساهمات الدكاترة
create table if not exists doctors (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text,
  office_location text,
  university_id uuid not null references universities(id) on delete cascade,
  courses text[] not null default '{}',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_doctors_university on doctors(university_id);
create index if not exists idx_doctors_name_trgm on doctors using gin (full_name gin_trgm_ops);
create index if not exists idx_doctors_courses_gin on doctors using gin (courses);
create unique index if not exists idx_doctors_email_unique on doctors (lower(email));

-- جدول ربط الدكاترة بالمساقات الفعلي (Many-to-Many)
create table if not exists doctor_courses (
  doctor_id uuid not null references doctors(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (doctor_id, course_id)
);
create index if not exists idx_doctor_courses_course on doctor_courses(course_id);
alter table doctor_courses enable row level security;
drop policy if exists "public read doctor courses" on doctor_courses;
create policy "public read doctor courses" on doctor_courses for select using (true);

create table if not exists doctor_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,
  submitter_name text,
  submitter_email text,
  kind text not null default 'new' check (kind in ('new','edit')),
  target_doctor_id uuid references doctors(id) on delete set null,
  full_name text not null,
  email text not null,
  phone text,
  office_location text,
  university_id uuid not null references universities(id) on delete cascade,
  courses text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint doctor_submission_edit_needs_target check (status <> 'pending' or kind = 'new' or target_doctor_id is not null)
);

alter table doctor_submissions alter column user_id drop not null;
alter table doctor_submissions add column if not exists submitter_name text;
alter table doctor_submissions add column if not exists submitter_email text;
alter table doctor_submissions drop constraint if exists doctor_submissions_user_id_fkey;
alter table doctor_submissions add constraint doctor_submissions_user_id_fkey
  foreign key (user_id) references profiles(id) on delete set null;

create index if not exists idx_doctor_submissions_user on doctor_submissions(user_id);
create index if not exists idx_doctor_submissions_status on doctor_submissions(status);
create index if not exists idx_doctor_submissions_target on doctor_submissions(target_doctor_id);
create index if not exists idx_doctor_submissions_created on doctor_submissions(created_at desc);

alter table doctors enable row level security;
alter table doctor_submissions enable row level security;

drop policy if exists "public read doctors" on doctors;
create policy "public read doctors" on doctors for select using (true);

drop policy if exists "users create own doctor submissions" on doctor_submissions;
drop policy if exists "users read own doctor submissions" on doctor_submissions;
create policy "users read own doctor submissions" on doctor_submissions for select to authenticated using (user_id = auth.uid());

-- جدول الإشعارات للمساهمين
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  message text not null,
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_user_unread on notifications(user_id, is_read, created_at desc);
alter table notifications enable row level security;
drop policy if exists "users read own notifications" on notifications;
create policy "users read own notifications" on notifications for select to authenticated using (user_id = auth.uid());

-- جدول البلاغات عن المواد (روابط معطلة، ملفات خاطئة، حقوق نشر)
create table if not exists material_reports (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references materials(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  reporter_email text,
  reason text not null check (reason in ('broken_link','wrong_file','copyright','inappropriate','other')),
  details text,
  status text not null default 'open' check (status in ('open','resolved','dismissed')),
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_material_reports_status on material_reports(status, created_at desc);
create index if not exists idx_material_reports_material on material_reports(material_id);
alter table material_reports enable row level security;

-- جدول تقييم المواد (مفيد 👍)
create table if not exists material_votes (
  material_id uuid not null references materials(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (material_id, user_id)
);
alter table material_votes enable row level security;
drop policy if exists "users read own votes" on material_votes;
create policy "users read own votes" on material_votes for select to authenticated using (user_id = auth.uid());

-- جدول المساقات المفضلة («مساقاتي»)
create table if not exists favorite_courses (
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, course_id)
);
alter table favorite_courses enable row level security;
drop policy if exists "users manage own favorite courses" on favorite_courses;
create policy "users manage own favorite courses" on favorite_courses for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
