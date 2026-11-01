-- ===========================================================================
-- توثيق المساقات المقبولة (2026-11-02) — آمن لإعادة التنفيذ
-- كل طلب مساق مقبول يُربط بسجل المساق الفعلي (created_course_id)، والمساقات
-- المقبولة سابقًا تُوثَّق (تُنشأ إن كانت ناقصة) فتصبح جاهزة للبحث والرفع.
-- ===========================================================================

-- 1) ربط الطلب بالمساق الموثّق
alter table submissions
  add column if not exists created_course_id uuid references courses(id) on delete set null;
create index if not exists idx_submissions_created_course on submissions(created_course_id);

-- 2) توثيق المساقات المقبولة سابقًا
do $$
declare
  s record;
  c_id uuid;
  linked int := 0;
  created int := 0;
begin
  for s in
    select id, suggested_course_name, suggested_course_code, suggested_university_id
    from submissions
    where kind = 'course'
      and status = 'approved'
      and created_course_id is null
      and suggested_university_id is not null
      and coalesce(btrim(suggested_course_name), '') <> ''
  loop
    -- مساق موجود بنفس الجامعة والرمز؟ نعتمده (الأقدم)
    select id into c_id
    from courses
    where university_id = s.suggested_university_id
      and lower(btrim(coalesce(code, ''))) = lower(btrim(coalesce(s.suggested_course_code, '')))
    order by created_at asc
    limit 1;

    -- وإلا فبنفس الجامعة والاسم
    if c_id is null then
      select id into c_id
      from courses
      where university_id = s.suggested_university_id
        and lower(btrim(name_ar)) = lower(btrim(s.suggested_course_name))
      order by created_at asc
      limit 1;
    end if;

    if c_id is null then
      insert into courses (university_id, name_ar, code)
      values (s.suggested_university_id, btrim(s.suggested_course_name), nullif(btrim(coalesce(s.suggested_course_code, '')), ''))
      returning id into c_id;
      created := created + 1;
    end if;

    update submissions set created_course_id = c_id where id = s.id;
    linked := linked + 1;
    c_id := null;
  end loop;

  raise notice 'documented approved courses: % linked, % newly created', linked, created;
end $$;

-- 3) منع تكرار نفس الرمز في الجامعة الواحدة مستقبلًا (يُتخطى بأمان إن وُجد تكرار قديم)
do $$
begin
  create unique index if not exists uq_courses_university_code
    on courses (university_id, lower(btrim(code)))
    where code is not null and btrim(code) <> '';
exception when unique_violation then
  raise notice 'uq_courses_university_code skipped: duplicate codes already exist — دمج المكرر ثم أعد التنفيذ';
end $$;

-- 4) جاهزية البحث: تحديث search_text لمواد المساقات الموثّقة وتحديث الإحصاءات
update materials set title_ar = title_ar
where course_id in (select created_course_id from submissions where created_course_id is not null);

analyze courses;
analyze submissions;
