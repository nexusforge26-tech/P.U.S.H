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

-- ===== تقوية الأمان (مطابق لترحيل 2026-10-18) =====


-- 1) سجل الرفع (حصة يومية لكل مستخدم لحماية مساحة Google Drive)
create table if not exists upload_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text,
  file_size bigint,
  created_at timestamptz not null default now()
);
create index if not exists idx_upload_log_user_time on upload_log(user_id, created_at desc);
alter table upload_log enable row level security;

-- 2) بصمة IP للبلاغات المجهولة (لا يُخزَّن العنوان نفسه)
alter table material_reports add column if not exists reporter_ip_hash text;
create index if not exists idx_material_reports_ip on material_reports(reporter_ip_hash, created_at desc);

-- 3) تصويت «مفيد» ذري: صوت واحد لكل حساب، بلا Race Condition
create or replace function public.cast_helpful_vote(p_material_id uuid, p_user_id uuid)
returns table(helpful_count integer, already_voted boolean)
language plpgsql
security definer set search_path = public
as $$
declare
  inserted integer;
begin
  if not exists (select 1 from materials where id = p_material_id) then
    return;
  end if;

  insert into material_votes(material_id, user_id)
  values (p_material_id, p_user_id)
  on conflict do nothing;
  get diagnostics inserted = row_count;

  if inserted > 0 then
    update materials set helpful_count = helpful_count + 1 where id = p_material_id;
  end if;

  return query
    select m.helpful_count, (inserted = 0) from materials m where m.id = p_material_id;
end;
$$;
revoke execute on function public.cast_helpful_vote(uuid, uuid) from public, anon, authenticated;
grant execute on function public.cast_helpful_vote(uuid, uuid) to service_role;

-- 4) ترقية «مالك» تلقائيًا فقط لبريد موثّق (منع انتحال بريد المالك)
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
    case when configured_owner is not null
              and lower(new.email) = lower(configured_owner)
              and new.email_confirmed_at is not null
         then 'owner' else 'user' end
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, profiles.full_name),
    avatar_url = coalesce(excluded.avatar_url, profiles.avatar_url);
  return new;
end;
$$;

-- 5) حدود أطوال على مستوى القاعدة (NOT VALID: تُطبَّق على الصفوف الجديدة دون كسر البيانات القديمة)
alter table submissions drop constraint if exists submissions_len_check;
alter table submissions add constraint submissions_len_check check (
  char_length(coalesce(title_ar,'')) <= 200 and char_length(coalesce(description_ar,'')) <= 2000
  and char_length(coalesce(suggested_course_name,'')) <= 150 and char_length(coalesce(suggested_course_code,'')) <= 40
) not valid;

alter table materials drop constraint if exists materials_len_check;
alter table materials add constraint materials_len_check check (
  char_length(coalesce(title_ar,'')) <= 300 and char_length(coalesce(description_ar,'')) <= 3000
) not valid;

alter table doctor_submissions drop constraint if exists doctor_submissions_len_check;
alter table doctor_submissions add constraint doctor_submissions_len_check check (
  char_length(full_name) <= 150 and char_length(email) <= 150
  and char_length(coalesce(office_location,'')) <= 150
  and cardinality(courses) <= 30
) not valid;

alter table material_reports drop constraint if exists material_reports_len_check;
alter table material_reports add constraint material_reports_len_check check (
  char_length(coalesce(details,'')) <= 1000 and char_length(coalesce(reporter_email,'')) <= 150
) not valid;

alter table universities drop constraint if exists universities_len_check;
alter table universities add constraint universities_len_check check (char_length(name_ar) <= 200) not valid;
alter table courses drop constraint if exists courses_len_check;
alter table courses add constraint courses_len_check check (
  char_length(name_ar) <= 200 and char_length(coalesce(code,'')) <= 40
) not valid;

-- 6) دفاع إضافي: لا كتابة مباشرة من مفتاح anon/المستخدمين على الجداول الحساسة
--    (كل الكتابة تمر عبر مسارات /api بمفتاح service_role). favorite_courses مستثناة لأن لها سياسة خاصة.
revoke insert, update, delete, truncate on
  public.profiles, public.submissions, public.doctor_submissions, public.materials,
  public.universities, public.courses, public.doctors, public.doctor_courses,
  public.notifications, public.material_reports, public.material_votes,
  public.activity_log, public.app_settings, public.upload_log
from anon, authenticated;
revoke all on public.app_settings, public.upload_log from anon, authenticated;

-- ===== الأداء وتدفق التسجيل الأول (مطابق لترحيل 2026-10-18-performance-and-onboarding) =====

-- 1) عمود تحويل المستخدم الجديد إلى «حسابي» مرة واحدة
alter table profiles add column if not exists onboarding_redirected_at timestamptz;
-- الحسابات الموجودة قبل هذا الترحيل ليست «تسجيلًا أول»: لا نحوّلها
update profiles set onboarding_redirected_at = coalesce(onboarding_redirected_at, now())
where onboarding_redirected_at is null;

-- 2) إحصائيات المنصة بدالة واحدة (كان الموقع يجلب downloads_count لكل المواد عند كل زيارة للرئيسية،
--    وهو بطيء ويعطي رقمًا خاطئًا عند تجاوز 1000 مادة بسبب حد الصفوف)
create or replace function public.get_platform_stats()
returns json
language sql
stable
security definer set search_path = public
as $$
  select json_build_object(
    'materials',    (select count(*) from materials),
    'courses',      (select count(*) from courses),
    'universities', (select count(*) from universities),
    'downloads',    (select coalesce(sum(downloads_count), 0) from materials)
  );
$$;
revoke execute on function public.get_platform_stats() from public;
grant execute on function public.get_platform_stats() to anon, authenticated, service_role;

-- مجاميع للوحة الإدارة (اختياري: ضمن جامعة معيّنة)
create or replace function public.sum_downloads(p_university_id uuid default null)
returns bigint
language sql
stable
security definer set search_path = public
as $$
  select coalesce(sum(m.downloads_count), 0)::bigint
  from materials m
  join courses c on c.id = m.course_id
  where p_university_id is null or c.university_id = p_university_id;
$$;
revoke execute on function public.sum_downloads(uuid) from public, anon, authenticated;
grant execute on function public.sum_downloads(uuid) to service_role;

-- 3) تعبئة search_text للمواد القديمة (الفهرس موجود لكن العمود كان فارغًا لما قبل المشغّل)
update materials set title_ar = title_ar where search_text is null;

-- تحديث search_text للمواد عند تعديل اسم/رمز المساق
create or replace function public.courses_refresh_materials_search()
returns trigger
language plpgsql
as $$
begin
  if new.name_ar is distinct from old.name_ar or new.code is distinct from old.code then
    update materials set title_ar = title_ar where course_id = new.id;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_courses_refresh_search on courses;
create trigger trg_courses_refresh_search after update on courses
for each row execute function public.courses_refresh_materials_search();

-- 4) فهارس للاستعلامات الأكثر استعمالًا
create index if not exists idx_materials_course_created on materials(course_id, created_at desc);
create index if not exists idx_materials_featured_created on materials(created_at desc) where is_featured;
create index if not exists idx_materials_type_created on materials(type, created_at desc);
create index if not exists idx_submissions_user_status on submissions(user_id, status);
create index if not exists idx_doctor_submissions_user_status on doctor_submissions(user_id, status);
create index if not exists idx_notifications_user_created on notifications(user_id, created_at desc);
create index if not exists idx_courses_university_name on courses(university_id, name_ar);

analyze materials;
analyze courses;
