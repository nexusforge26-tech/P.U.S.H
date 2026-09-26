-- PUSH hierarchy/contributions upgrade
-- Run this file in Supabase SQL Editor on an existing installation.
-- It is also included in supabase/schema.sql.

alter table courses add column if not exists code text;
update courses set code='UNASSIGNED-'||left(replace(id::text,'-',''),8) where code is null or length(trim(code))=0;
alter table courses alter column code set not null;
alter table courses drop constraint if exists courses_code_required;
alter table courses add constraint courses_code_required check(length(trim(code))>0);

alter table materials add column if not exists created_by uuid references profiles(id) on delete set null;
alter table materials add column if not exists source_submission_id uuid;
alter table materials add column if not exists updated_at timestamptz not null default now();

create table if not exists course_requests(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references profiles(id) on delete cascade,
 faculty_id uuid not null references faculties(id) on delete cascade,
 name_ar text not null, code text not null,
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 admin_note text, reviewed_by uuid references auth.users(id) on delete set null,
 reviewed_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists publication_logs(
 id uuid primary key default gen_random_uuid(),
 actor_id uuid references profiles(id) on delete set null,
 action text not null check(action in('material_submitted','material_published','material_updated','material_deleted','course_requested','course_created')),
 material_id uuid references materials(id) on delete set null,
 course_id uuid references courses(id) on delete set null,
 submission_id uuid references submissions(id) on delete set null,
 details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);

alter table course_requests enable row level security;
alter table publication_logs enable row level security;
drop policy if exists "users create course requests" on course_requests;
drop policy if exists "users read own course requests" on course_requests;
create policy "users create course requests" on course_requests for insert to authenticated with check(user_id=auth.uid());
create policy "users read own course requests" on course_requests for select to authenticated using(user_id=auth.uid());
