-- ===========================================================================
-- عدّاد زيارات الموقع (2026-11-03) — آمن لإعادة التنفيذ
-- صف واحد لكل يوم (بتوقيت فلسطين Asia/Hebron) فيبدأ العدّ اليومي من صفر كل يوم،
-- والإجمالي = مجموع الأيام. لا يُخزَّن أي IP أو معرّف شخصي.
-- ===========================================================================

create table if not exists site_visit_daily (
  day date primary key,
  total_visits bigint not null default 0,
  member_visits bigint not null default 0,
  guest_visits bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table site_visit_daily enable row level security;
revoke all on site_visit_daily from anon, authenticated;

-- تسجيل زيارة (زيادة ذرّية، بلا سباق بين الطلبات المتزامنة)
create or replace function public.record_site_visit(p_is_member boolean)
returns void
language sql
security definer set search_path = public
as $$
  insert into site_visit_daily as d (day, total_visits, member_visits, guest_visits)
  values (
    (now() at time zone 'Asia/Hebron')::date,
    1,
    case when p_is_member then 1 else 0 end,
    case when p_is_member then 0 else 1 end
  )
  on conflict (day) do update set
    total_visits  = d.total_visits  + 1,
    member_visits = d.member_visits + excluded.member_visits,
    guest_visits  = d.guest_visits  + excluded.guest_visits,
    updated_at    = now();
$$;
revoke execute on function public.record_site_visit(boolean) from public, anon, authenticated;
grant execute on function public.record_site_visit(boolean) to service_role;

-- إحصاءات لوحة المالك: اليوم، أمس، الإجمالي، وآخر 14 يومًا
create or replace function public.get_visit_stats()
returns json
language sql
stable
security definer set search_path = public
as $$
  with t as (select (now() at time zone 'Asia/Hebron')::date as today)
  select json_build_object(
    'today',          coalesce((select d.total_visits  from site_visit_daily d, t where d.day = t.today), 0),
    'today_members',  coalesce((select d.member_visits from site_visit_daily d, t where d.day = t.today), 0),
    'today_guests',   coalesce((select d.guest_visits  from site_visit_daily d, t where d.day = t.today), 0),
    'yesterday',      coalesce((select d.total_visits  from site_visit_daily d, t where d.day = t.today - 1), 0),
    'total',          coalesce((select sum(total_visits)  from site_visit_daily), 0),
    'total_members',  coalesce((select sum(member_visits) from site_visit_daily), 0),
    'total_guests',   coalesce((select sum(guest_visits)  from site_visit_daily), 0),
    'since',          (select min(day) from site_visit_daily),
    'days', coalesce((
      select json_agg(json_build_object('day', g.day, 'visits', coalesce(d.total_visits, 0)) order by g.day)
      from (select x::date as day from t, generate_series(t.today - 13, t.today, interval '1 day') x) g
      left join site_visit_daily d on d.day = g.day
    ), '[]'::json)
  );
$$;
revoke execute on function public.get_visit_stats() from public, anon, authenticated;
grant execute on function public.get_visit_stats() to service_role;
