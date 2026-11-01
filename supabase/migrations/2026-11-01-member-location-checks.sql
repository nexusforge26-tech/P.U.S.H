-- Latest browser-reported location check only; exact coordinates are visible through admin APIs only.
create table if not exists public.member_location_checks (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  status text not null check (status in ('inside', 'outside')),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_m double precision not null check (accuracy_m >= 0 and accuracy_m <= 1000000),
  checked_at timestamptz not null default now()
);

comment on table public.member_location_checks is
  'Stores only a member’s latest browser-reported location check. Exact coordinates are sensitive and are accessed only through authenticated owner/admin server routes.';
comment on column public.member_location_checks.latitude is 'Latest browser-reported latitude; do not log or include in bulk exports.';
comment on column public.member_location_checks.longitude is 'Latest browser-reported longitude; do not log or include in bulk exports.';
comment on column public.member_location_checks.accuracy_m is 'Browser-reported horizontal accuracy in meters; this does not prove physical presence.';

alter table public.member_location_checks enable row level security;
revoke all on table public.member_location_checks from public, anon, authenticated;
grant all on table public.member_location_checks to service_role;
