-- PUSH — database schema
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
  code text not null,
  created_at timestamptz not null default now(),
  constraint courses_code_required check (length(trim(code)) > 0)
);
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  role text not null default 'user' check (role in ('user','admin','owner')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists materials (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  title_ar text not null,
  description_ar text,
  type text not null check (type in ('exam','summary','file','video')),
  academic_year text,
  semester text,
  drive_link text,
  youtube_id text,
  is_featured boolean not null default false,
  downloads_count integer not null default 0,
  created_by uuid references profiles(id) on delete set null,
  source_submission_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint material_has_source check ((type = 'video' and youtube_id is not null) or (type <> 'video' and drive_link is not null))
);

create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
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

create table if not exists course_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  faculty_id uuid not null references faculties(id) on delete cascade,
  name_ar text not null,
  code text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint course_request_code_required check (length(trim(code)) > 0)
);

create table if not exists publication_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id) on delete set null,
  action text not null check (action in ('material_submitted','material_published','material_updated','material_deleted','course_requested','course_created')),
  material_id uuid references materials(id) on delete set null,
  course_id uuid references courses(id) on delete set null,
  submission_id uuid references submissions(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Existing installations: safe upgrades
alter table courses add column if not exists code text;
alter table materials add column if not exists created_by uuid references profiles(id) on delete set null;
alter table materials add column if not exists source_submission_id uuid;
alter table materials add column if not exists updated_at timestamptz not null default now();
alter table submissions drop constraint if exists submissions_user_id_fkey;
alter table submissions add constraint submissions_user_id_fkey foreign key (user_id) references profiles(id) on delete cascade;
update courses set code = 'UNASSIGNED-' || left(replace(id::text,'-',''),8) where code is null or length(trim(code))=0;
alter table courses alter column code set not null;
alter table courses drop constraint if exists courses_code_required;
alter table courses add constraint courses_code_required check (length(trim(code)) > 0);

create index if not exists idx_faculties_university on faculties(university_id);
create index if not exists idx_courses_faculty on courses(faculty_id);
create index if not exists idx_courses_code on courses(code);
create index if not exists idx_courses_name_trgm on courses using gin (name_ar gin_trgm_ops);
create index if not exists idx_materials_course on materials(course_id);
create index if not exists idx_materials_type on materials(type);
create index if not exists idx_materials_featured on materials(is_featured);
create index if not exists idx_materials_title_trgm on materials using gin (title_ar gin_trgm_ops);
create index if not exists idx_materials_created_by on materials(created_by);
create index if not exists idx_submissions_user on submissions(user_id);
create index if not exists idx_submissions_status on submissions(status);
create index if not exists idx_submissions_created on submissions(created_at desc);
create index if not exists idx_course_requests_status on course_requests(status);
create index if not exists idx_publication_logs_actor on publication_logs(actor_id);
create index if not exists idx_publication_logs_created on publication_logs(created_at desc);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id,email,full_name,avatar_url,role)
  values (new.id, lower(new.email), coalesce(new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name'),
          new.raw_user_meta_data->>'avatar_url',
          case when lower(new.email)=lower('ydha957@gmail.com') then 'owner' else 'user' end)
  on conflict (id) do update set email=excluded.email,
    full_name=coalesce(excluded.full_name,profiles.full_name), avatar_url=coalesce(excluded.avatar_url,profiles.avatar_url);
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

insert into public.profiles(id,email,full_name,avatar_url,role)
select id,lower(email),coalesce(raw_user_meta_data->>'full_name',raw_user_meta_data->>'name'),
       raw_user_meta_data->>'avatar_url',
       case when lower(email)=lower('ydha957@gmail.com') then 'owner' else 'user' end
from auth.users
on conflict(id) do update set email=excluded.email, role=case when lower(excluded.email)=lower('ydha957@gmail.com') then 'owner' else profiles.role end;

alter table universities enable row level security;
alter table faculties enable row level security;
alter table courses enable row level security;
alter table materials enable row level security;
alter table profiles enable row level security;
alter table submissions enable row level security;
alter table course_requests enable row level security;
alter table publication_logs enable row level security;

drop policy if exists "public read universities" on universities;
drop policy if exists "public read faculties" on faculties;
drop policy if exists "public read courses" on courses;
drop policy if exists "public read materials" on materials;
create policy "public read universities" on universities for select using (true);
create policy "public read faculties" on faculties for select using (true);
create policy "public read courses" on courses for select using (true);
create policy "public read materials" on materials for select using (true);

drop policy if exists "users read own profile" on profiles;
create policy "users read own profile" on profiles for select to authenticated using (id=auth.uid());

drop policy if exists "users create own submissions" on submissions;
drop policy if exists "users read own submissions" on submissions;
create policy "users create own submissions" on submissions for insert to authenticated with check(user_id=auth.uid());
create policy "users read own submissions" on submissions for select to authenticated using(user_id=auth.uid());

drop policy if exists "users create course requests" on course_requests;
drop policy if exists "users read own course requests" on course_requests;
create policy "users create course requests" on course_requests for insert to authenticated with check(user_id=auth.uid());
create policy "users read own course requests" on course_requests for select to authenticated using(user_id=auth.uid());

create or replace function increment_downloads(material_id uuid)
returns void language sql security definer set search_path=public as $$
 update materials set downloads_count=downloads_count+1 where id=material_id;
$$;
grant execute on function increment_downloads(uuid) to anon,authenticated;
