-- ===========================================================================
-- ترحيل الأداء + تدفق التسجيل الأول (2026-10-18) — آمن لإعادة التنفيذ
-- ===========================================================================

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
