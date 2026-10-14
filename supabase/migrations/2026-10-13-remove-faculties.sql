-- ===========================================================================
-- إزالة الكليات: الهيكل الجديد  جامعة ← مساق ← منشورات
-- لقاعدة بيانات قائمة. آمن لإعادة التنفيذ. نفّذه في Supabase SQL Editor
-- *قبل* نشر الكود الجديد على Vercel. بياناتك (المساقات والمواد) تبقى كما هي.
-- ===========================================================================
begin;

-- 1) المساقات ترتبط بالجامعة مباشرة (تُنقل القيمة من كلية المساق).
alter table courses add column if not exists university_id uuid references universities(id) on delete cascade;
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='courses' and column_name='faculty_id') then
    update courses c set university_id = f.university_id from faculties f where c.faculty_id = f.id and c.university_id is null;
  end if;
end $$;
alter table courses alter column university_id set not null;
create index if not exists idx_courses_university on courses(university_id);

-- 2) اقتراحات المساقات المعلقة: الجامعة بدل الكلية.
alter table submissions add column if not exists suggested_university_id uuid references universities(id) on delete cascade;
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='submissions' and column_name='suggested_faculty_id') then
    update submissions s set suggested_university_id = f.university_id from faculties f where s.suggested_faculty_id = f.id and s.suggested_university_id is null;
  end if;
end $$;
alter table submissions drop constraint if exists submission_course_or_material_check;
alter table submissions drop column if exists suggested_faculty_id;
alter table submissions add constraint submission_course_or_material_check check (
  (kind = 'material' and course_id is not null) or
  (kind = 'course' and suggested_course_name is not null and suggested_course_code is not null and suggested_university_id is not null)
);

-- 3) الدكاترة: حذف حقل الكلية.
alter table doctors drop column if exists faculty_id;
alter table doctor_submissions drop column if exists faculty_id;

-- 4) حذف عمود الكلية من المساقات ثم جدول الكليات نفسه.
alter table courses drop column if exists faculty_id;
drop table if exists faculties cascade;

commit;
