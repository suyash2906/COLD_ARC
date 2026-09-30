-- Duels could be edited directly by either player, which let anyone mark a duel settled
-- and name themselves the winner. Answering a challenge now goes through an RPC, and
-- settlement stays with settle_due_duels(). Safe to re-run.

drop policy if exists duels_update on public.duels;

-- A new challenge must start open, or a challenger could insert one already won.
drop policy if exists duels_insert on public.duels;
create policy duels_insert on public.duels
  for insert with check (
    challenger_id = auth.uid()
    and public.shares_squad_with(opponent_id)
    and status = 'pending'
    and winner_id is null
  );

create or replace function public.respond_to_duel(duel_id uuid, accept boolean)
returns public.duels
language plpgsql volatile security definer set search_path = public as $$
declare
  d public.duels;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  update public.duels
  set status = case when accept then 'active' else 'declined' end
  where id = duel_id
    and opponent_id = auth.uid()
    and status = 'pending'
  returning * into d;

  if not found then
    raise exception 'That challenge is no longer open';
  end if;

  return d;
end;
$$;

grant execute on function public.respond_to_duel(uuid, boolean) to authenticated;
