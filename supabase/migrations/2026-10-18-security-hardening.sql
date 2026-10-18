-- ===========================================================================
-- ترحيل تقوية الأمان (2026-10-18) — آمن لإعادة التنفيذ (idempotent)
-- ===========================================================================
begin;

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
  and char_length(coalesce(phone,'')) <= 40 and char_length(coalesce(office_location,'')) <= 150
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

commit;
