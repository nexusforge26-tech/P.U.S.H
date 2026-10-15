-- ===========================================================================
-- ترحيل شامل للأمان، الفهارس، تطبيع البحث العربي، والميزات الجديدة (2026-10-15)
-- آمن لإعادة التنفيذ (Idempotent) على قاعدة بيانات قائمة.
-- ===========================================================================
begin;

create extension if not exists "pgcrypto";
create extension if not exists pg_trgm;

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

create table if not exists app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table app_settings enable row level security;

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

alter table materials add column if not exists is_verified boolean not null default false;
alter table materials add column if not exists helpful_count integer not null default 0;
alter table materials add column if not exists file_size bigint;
alter table materials add column if not exists mime_type text;
alter table materials add column if not exists page_count integer;
alter table materials add column if not exists search_text text;

create index if not exists idx_materials_created_at on materials(created_at desc);
create index if not exists idx_materials_downloads on materials(downloads_count desc);
create index if not exists idx_materials_search_trgm on materials using gin (search_text gin_trgm_ops);
create index if not exists idx_courses_name_trgm on courses using gin (name_ar gin_trgm_ops);
create index if not exists idx_courses_code_trgm on courses using gin (code gin_trgm_ops);
create index if not exists idx_doctors_courses_gin on doctors using gin (courses);
create unique index if not exists idx_doctors_email_unique on doctors (lower(email));

alter table submissions alter column user_id drop not null;
alter table submissions alter column type drop not null;
alter table submissions add column if not exists submitter_name text;
alter table submissions add column if not exists submitter_email text;
alter table submissions add column if not exists target_material_id uuid references materials(id) on delete cascade;
alter table submissions add column if not exists file_size bigint;
alter table submissions add column if not exists mime_type text;
alter table submissions add column if not exists page_count integer;

alter table submissions drop constraint if exists submissions_user_id_fkey;
alter table submissions add constraint submissions_user_id_fkey
  foreign key (user_id) references profiles(id) on delete set null;

alter table submissions drop constraint if exists submissions_kind_check;
alter table submissions add constraint submissions_kind_check
  check (kind in ('material','course','material_edit'));

alter table submissions drop constraint if exists submission_has_source;
alter table submissions drop constraint if exists submission_course_or_material_check;
alter table submissions add constraint submission_course_or_material_check check (
  (kind = 'material' and course_id is not null and ((type = 'video' and youtube_id is not null) or (type <> 'video' and drive_link is not null))) or
  (kind = 'material_edit' and target_material_id is not null and course_id is not null) or
  (kind = 'course' and suggested_course_name is not null and suggested_course_code is not null and suggested_university_id is not null)
);

alter table doctor_submissions alter column user_id drop not null;
alter table doctor_submissions add column if not exists submitter_name text;
alter table doctor_submissions add column if not exists submitter_email text;
alter table doctor_submissions drop constraint if exists doctor_submissions_user_id_fkey;
alter table doctor_submissions add constraint doctor_submissions_user_id_fkey
  foreign key (user_id) references profiles(id) on delete set null;

drop policy if exists "users create own submissions" on submissions;
drop policy if exists "users create own doctor submissions" on doctor_submissions;

revoke execute on function increment_downloads(uuid) from public, anon, authenticated;
grant execute on function increment_downloads(uuid) to service_role;

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
alter table material_reports enable row level security;

create table if not exists material_votes (
  material_id uuid not null references materials(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (material_id, user_id)
);
alter table material_votes enable row level security;

create table if not exists favorite_courses (
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, course_id)
);
alter table favorite_courses enable row level security;

commit;
