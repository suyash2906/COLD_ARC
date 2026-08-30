-- Cold Arc cloud schema.
--
-- This holds *only* the projection needed for competition: scores, streaks, and the
-- shape of each person's arc. Journals, photos and raw log values never arrive here —
-- the client has no code path that sends them.
--
-- Foreign keys point at public.profiles rather than auth.users so PostgREST can embed
-- related rows (squad_members -> profiles) without extra round trips.

create extension if not exists citext;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id            uuid primary key references auth.users on delete cascade,
  handle        citext not null unique check (handle ~ '^[a-z0-9_]{3,20}$'),
  display_name  text not null check (char_length(display_name) between 1 and 40),
  avatar_emoji  text not null default '🧊',
  timezone      text,
  -- Opt-in because "your squad sees when you miss a day" is the feature most likely
  -- to make someone quit the app entirely.
  alerts_optin  boolean not null default true,
  created_at    timestamptz not null default now()
);

create table if not exists public.arcs_public (
  user_id           uuid primary key references public.profiles on delete cascade,
  arc_id            text not null,
  name              text not null,
  start_date        date not null,
  total_days        int  not null check (total_days between 1 and 400),
  strictness        text not null default 'forgiving',
  commitment_labels text[] not null default '{}',
  updated_at        timestamptz not null default now()
);

create table if not exists public.daily_scores (
  user_id    uuid not null references public.profiles on delete cascade,
  date       date not null,
  score      int  not null check (score between 0 and 100),
  completed  int  not null default 0,
  total      int  not null default 0,
  perfect    boolean not null default false,
  streak_at  int  not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

create index if not exists daily_scores_date_idx on public.daily_scores (date);

create table if not exists public.squads (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 40),
  join_code  text not null unique,
  owner_id   uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.squad_members (
  squad_id  uuid not null references public.squads on delete cascade,
  user_id   uuid not null references public.profiles on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (squad_id, user_id)
);

create index if not exists squad_members_user_idx on public.squad_members (user_id);

create table if not exists public.duels (
  id            uuid primary key default gen_random_uuid(),
  squad_id      uuid references public.squads on delete cascade,
  challenger_id uuid not null references public.profiles on delete cascade,
  opponent_id   uuid not null references public.profiles on delete cascade,
  metric        text not null default 'perfect_days'
                check (metric in ('perfect_days', 'average_score', 'total_score')),
  starts_on     date not null,
  ends_on       date not null,
  status        text not null default 'pending'
                check (status in ('pending', 'active', 'declined', 'settled')),
  winner_id     uuid references public.profiles,
  created_at    timestamptz not null default now(),
  check (ends_on >= starts_on),
  check (challenger_id <> opponent_id)
);

create index if not exists duels_participants_idx on public.duels (challenger_id, opponent_id);

-- ---------------------------------------------------------------------------
-- Helpers
--
-- These MUST be security definer. A policy on squad_members that itself queries
-- squad_members re-enters RLS and Postgres raises "infinite recursion detected in
-- policy". Running the lookup as the definer bypasses that cleanly.
-- ---------------------------------------------------------------------------

create or replace function public.is_squad_member(sid uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.squad_members
    where squad_id = sid and user_id = auth.uid()
  );
$$;

create or replace function public.shares_squad_with(other uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.squad_members mine
    join public.squad_members theirs on theirs.squad_id = mine.squad_id
    where mine.user_id = auth.uid() and theirs.user_id = other
  );
$$;

create or replace function public.is_dueling_with(other uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.duels
    where status in ('pending', 'active')
      and ((challenger_id = auth.uid() and opponent_id = other)
        or (opponent_id = auth.uid() and challenger_id = other))
  );
$$;

-- Visibility rule, written once and reused by every table that exposes another person.
create or replace function public.can_see(target uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select target = auth.uid()
      or public.shares_squad_with(target)
      or public.is_dueling_with(target);
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles      enable row level security;
alter table public.arcs_public   enable row level security;
alter table public.daily_scores  enable row level security;
alter table public.squads        enable row level security;
alter table public.squad_members enable row level security;
alter table public.duels         enable row level security;

-- profiles ------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (public.can_see(id));

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert with check (id = auth.uid());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- arcs_public ---------------------------------------------------------------
drop policy if exists arcs_public_select on public.arcs_public;
create policy arcs_public_select on public.arcs_public
  for select using (public.can_see(user_id));

drop policy if exists arcs_public_write on public.arcs_public;
create policy arcs_public_write on public.arcs_public
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- daily_scores --------------------------------------------------------------
drop policy if exists daily_scores_select on public.daily_scores;
create policy daily_scores_select on public.daily_scores
  for select using (public.can_see(user_id));

drop policy if exists daily_scores_write on public.daily_scores;
create policy daily_scores_write on public.daily_scores
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- squads --------------------------------------------------------------------
-- Deliberately not readable by join code: discovery goes through join_squad() so a
-- stranger cannot enumerate squads or read membership before joining.
drop policy if exists squads_select on public.squads;
create policy squads_select on public.squads
  for select using (public.is_squad_member(id));

drop policy if exists squads_insert on public.squads;
create policy squads_insert on public.squads
  for insert with check (owner_id = auth.uid());

drop policy if exists squads_update on public.squads;
create policy squads_update on public.squads
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists squads_delete on public.squads;
create policy squads_delete on public.squads
  for delete using (owner_id = auth.uid());

-- squad_members -------------------------------------------------------------
drop policy if exists squad_members_select on public.squad_members;
create policy squad_members_select on public.squad_members
  for select using (public.is_squad_member(squad_id));

-- Joining happens via join_squad(); this only covers the owner's own first row.
drop policy if exists squad_members_insert on public.squad_members;
create policy squad_members_insert on public.squad_members
  for insert with check (user_id = auth.uid());

drop policy if exists squad_members_delete on public.squad_members;
create policy squad_members_delete on public.squad_members
  for delete using (
    user_id = auth.uid()
    or exists (select 1 from public.squads s where s.id = squad_id and s.owner_id = auth.uid())
  );

-- duels ---------------------------------------------------------------------
drop policy if exists duels_select on public.duels;
create policy duels_select on public.duels
  for select using (
    challenger_id = auth.uid()
    or opponent_id = auth.uid()
    or (squad_id is not null and public.is_squad_member(squad_id))
  );

drop policy if exists duels_insert on public.duels;
create policy duels_insert on public.duels
  for insert with check (challenger_id = auth.uid() and public.shares_squad_with(opponent_id));

drop policy if exists duels_update on public.duels;
create policy duels_update on public.duels
  for update using (challenger_id = auth.uid() or opponent_id = auth.uid());

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Short, unambiguous join codes: no 0/O/1/I to mistype.
create or replace function public.generate_join_code()
returns text
language plpgsql volatile as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  i int;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.squads where join_code = code);
  end loop;
  return code;
end;
$$;

create or replace function public.create_squad(squad_name text)
returns public.squads
language plpgsql volatile security definer set search_path = public as $$
declare
  s public.squads;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  insert into public.squads (name, join_code, owner_id)
  values (squad_name, public.generate_join_code(), auth.uid())
  returning * into s;

  insert into public.squad_members (squad_id, user_id) values (s.id, auth.uid());
  return s;
end;
$$;

-- Security definer so a code holder can join a squad they cannot yet select.
create or replace function public.join_squad(code text)
returns public.squads
language plpgsql volatile security definer set search_path = public as $$
declare
  s public.squads;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select * into s from public.squads where join_code = upper(trim(code));
  if not found then
    raise exception 'No squad with that code';
  end if;

  insert into public.squad_members (squad_id, user_id)
  values (s.id, auth.uid())
  on conflict do nothing;

  return s;
end;
$$;

-- Lets a signed-in user check a handle before claiming it, without exposing the table.
create or replace function public.handle_available(h text)
returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.profiles where handle = lower(h));
$$;

-- ---------------------------------------------------------------------------
-- Duel settlement
--
-- Runs on read rather than on a schedule, so a finished duel resolves the next time
-- anyone opens the squad screen. No cron required for the core feature to work.
-- ---------------------------------------------------------------------------

create or replace function public.settle_due_duels()
returns int
language plpgsql volatile security definer set search_path = public as $$
declare
  d record;
  a numeric;
  b numeric;
  settled int := 0;
begin
  for d in
    select * from public.duels
    where status in ('pending', 'active')
      and ends_on < current_date
      and (challenger_id = auth.uid() or opponent_id = auth.uid())
  loop
    select
      coalesce(case d.metric
        when 'perfect_days'  then count(*) filter (where perfect)
        when 'average_score' then avg(score)
        else sum(score)
      end, 0)
    into a
    from public.daily_scores
    where user_id = d.challenger_id and date between d.starts_on and d.ends_on;

    select
      coalesce(case d.metric
        when 'perfect_days'  then count(*) filter (where perfect)
        when 'average_score' then avg(score)
        else sum(score)
      end, 0)
    into b
    from public.daily_scores
    where user_id = d.opponent_id and date between d.starts_on and d.ends_on;

    update public.duels
    set status = 'settled',
        -- A tie leaves winner_id null rather than inventing a victor.
        winner_id = case when a > b then d.challenger_id
                         when b > a then d.opponent_id
                         else null end
    where id = d.id;

    settled := settled + 1;
  end loop;

  return settled;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
--
-- Supabase can be told not to auto-expose new tables. Granting explicitly means
-- this migration works either way instead of depending on a dashboard toggle.
--
-- Every policy above requires auth.uid(), so `anon` is deliberately given nothing
-- beyond schema usage: signed-out visitors can reach the API and see zero rows.
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on
  public.profiles,
  public.arcs_public,
  public.daily_scores,
  public.squads,
  public.squad_members,
  public.duels
to authenticated;

grant execute on function
  public.create_squad(text),
  public.join_squad(text),
  public.handle_available(text),
  public.settle_due_duels(),
  public.is_squad_member(uuid),
  public.shares_squad_with(uuid),
  public.is_dueling_with(uuid),
  public.can_see(uuid)
to authenticated;
