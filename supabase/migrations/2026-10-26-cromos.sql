-- =====================================================================
-- Saga Quest · Cromos (sobre diario, cromo al terminar un juego e intercambios)
-- Ejecutar una vez en Supabase → SQL Editor. Se puede volver a ejecutar sin problema.
--
--   cards          cada cromo: de quién es, de qué juego, rareza y si es brillante
--   card_packs     qué día abrió cada usuario su sobre (uno al día)
--   card_trades    intercambios entre amigos (mi cromo por el suyo)
--
-- Los cromos solo se crean y cambian de dueño con las funciones de abajo (en la base de datos):
-- así nadie puede inventarse cromos ni quedarse con los de otro.
-- =====================================================================

create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references public.profiles (id) on delete cascade,
  game_id text not null references public.games (id) on delete cascade,
  rarity text not null check (rarity in ('common', 'rare', 'epic', 'legendary')),
  foil boolean not null default false,
  source text not null check (source in ('pack', 'finish', 'trade')),
  obtained_at timestamptz not null default now()
);
create index if not exists cards_owner_idx on public.cards (owner, obtained_at desc);
create unique index if not exists cards_finish_once on public.cards (owner, game_id) where source = 'finish';

create table if not exists public.card_packs (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  opened_on date not null,
  opened_at timestamptz not null default now(),
  primary key (profile_id, opened_on)
);

create table if not exists public.card_trades (
  id uuid primary key default gen_random_uuid(),
  from_profile uuid not null references public.profiles (id) on delete cascade,
  to_profile uuid not null references public.profiles (id) on delete cascade,
  offer_card uuid not null references public.cards (id) on delete cascade,
  want_card uuid not null references public.cards (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  check (from_profile <> to_profile)
);
create index if not exists card_trades_to_idx on public.card_trades (to_profile, status);
create index if not exists card_trades_from_idx on public.card_trades (from_profile, status);

comment on table public.cards is 'Cromos: dueño, juego, rareza (según la nota del juego) y si es brillante.';
comment on table public.card_packs is 'Día en que cada usuario abrió su sobre diario.';
comment on table public.card_trades is 'Intercambios de cromos entre amigos.';

-- ---------- Permisos: se leen, pero solo se escriben con las funciones ----------
alter table public.cards enable row level security;
alter table public.card_packs enable row level security;
alter table public.card_trades enable row level security;
revoke all on public.cards, public.card_packs, public.card_trades from anon;
grant select on public.cards, public.card_packs, public.card_trades to authenticated;

drop policy if exists "cards read" on public.cards;
create policy "cards read" on public.cards for select to authenticated
  using (owner = auth.uid() or public.are_friends(auth.uid(), owner));
drop policy if exists "packs read own" on public.card_packs;
create policy "packs read own" on public.card_packs for select to authenticated using (profile_id = auth.uid());
drop policy if exists "trades read own" on public.card_trades;
create policy "trades read own" on public.card_trades for select to authenticated
  using (auth.uid() in (from_profile, to_profile));

-- ---------- Rareza según la nota de la crítica ----------
create or replace function public.card_rarity(score int)
returns text language sql immutable as $$
  select case
    when score >= 90 then 'legendary'
    when score >= 80 then 'epic'
    when score >= 70 then 'rare'
    else 'common'
  end;
$$;

-- ---------- Sobre diario: 3 cromos al azar (uno al día, hora de España) ----------
create or replace function public.open_daily_pack()
returns setof public.cards
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  today date := (now() at time zone 'Europe/Madrid')::date;
  roll float;
  want text;
  gid text;
  grade text;
  c public.cards;
  i int;
begin
  if me is null then raise exception 'Sin sesión'; end if;
  insert into public.card_packs (profile_id, opened_on) values (me, today)
  on conflict do nothing;
  if not found then raise exception 'Ya has abierto el sobre de hoy'; end if;
  for i in 1..3 loop
    roll := random();
    want := case when roll < 0.05 then 'legendary' when roll < 0.20 then 'epic' when roll < 0.50 then 'rare' else 'common' end;
    select g.id, public.card_rarity(coalesce(g.critic_rating, 0)) into gid, grade
    from public.games g
    where g.source in ('igdb', 'rawg') and g.cover_url is not null
      and public.card_rarity(coalesce(g.critic_rating, 0)) = want
    order by random() limit 1;
    if gid is null then
      select g.id, public.card_rarity(coalesce(g.critic_rating, 0)) into gid, grade
      from public.games g
      where g.source in ('igdb', 'rawg') and g.cover_url is not null
      order by random() limit 1;
    end if;
    if gid is null then raise exception 'Aún no hay juegos para los sobres'; end if;
    insert into public.cards (owner, game_id, rarity, foil, source)
    values (me, gid, grade, random() < 0.08, 'pack')
    returning * into c;
    return next c;
    gid := null;
  end loop;
end;
$$;

-- ---------- Cromo de cada juego que terminas (una vez por juego) ----------
create or replace function public.claim_finish_cards()
returns setof public.cards
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if me is null then return; end if;
  return query
  insert into public.cards (owner, game_id, rarity, foil, source)
  select me, ug.game_id, public.card_rarity(coalesce(g.critic_rating, 0)), ug.status = 'completed', 'finish'
  from public.user_games ug
  join public.games g on g.id = ug.game_id
  where ug.profile_id = me and ug.status in ('beaten', 'completed')
    and not exists (select 1 from public.cards c where c.owner = me and c.game_id = ug.game_id and c.source = 'finish')
  on conflict do nothing
  returning *;
end;
$$;

-- ---------- Intercambios ----------
-- Propones tu cromo a cambio de uno de un amigo.
create or replace function public.propose_card_trade(offer uuid, want uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  other uuid;
  tid uuid;
begin
  if not exists (select 1 from public.cards where id = offer and owner = me) then
    raise exception 'Ese cromo no es tuyo';
  end if;
  select owner into other from public.cards where id = want;
  if other is null or other = me then raise exception 'Cromo no válido'; end if;
  if not public.are_friends(me, other) then raise exception 'Solo puedes intercambiar con tus amigos'; end if;
  if exists (select 1 from public.card_trades where status = 'pending' and (offer_card = offer or want_card = want) and from_profile = me) then
    raise exception 'Ya tienes un intercambio pendiente con ese cromo';
  end if;
  insert into public.card_trades (from_profile, to_profile, offer_card, want_card)
  values (me, other, offer, want) returning id into tid;
  return tid;
end;
$$;

-- El otro acepta (se cambian los dueños de golpe) o lo rechaza.
create or replace function public.respond_card_trade(trade uuid, accept boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  t public.card_trades;
begin
  select * into t from public.card_trades where id = trade for update;
  if t.id is null or t.to_profile <> me or t.status <> 'pending' then
    raise exception 'Este intercambio ya no está disponible';
  end if;
  if not accept then
    update public.card_trades set status = 'declined', resolved_at = now() where id = trade;
    return;
  end if;
  -- Los dos cromos tienen que seguir siendo de quien eran.
  if not exists (select 1 from public.cards where id = t.offer_card and owner = t.from_profile)
     or not exists (select 1 from public.cards where id = t.want_card and owner = t.to_profile) then
    update public.card_trades set status = 'cancelled', resolved_at = now() where id = trade;
    raise exception 'Alguno de los cromos ya no está';
  end if;
  update public.cards set owner = t.to_profile, source = 'trade', obtained_at = now() where id = t.offer_card;
  update public.cards set owner = t.from_profile, source = 'trade', obtained_at = now() where id = t.want_card;
  update public.card_trades set status = 'accepted', resolved_at = now() where id = trade;
  -- Otros intercambios pendientes con esos cromos ya no tienen sentido.
  update public.card_trades set status = 'cancelled', resolved_at = now()
  where status = 'pending' and id <> trade
    and (offer_card in (t.offer_card, t.want_card) or want_card in (t.offer_card, t.want_card));
end;
$$;

-- Quien lo propuso lo puede retirar.
create or replace function public.cancel_card_trade(trade uuid)
returns void
language sql security definer set search_path = public as $$
  update public.card_trades set status = 'cancelled', resolved_at = now()
  where id = trade and from_profile = auth.uid() and status = 'pending';
$$;

revoke all on function public.open_daily_pack(), public.claim_finish_cards(), public.propose_card_trade(uuid, uuid),
  public.respond_card_trade(uuid, boolean), public.cancel_card_trade(uuid) from public, anon;
grant execute on function public.open_daily_pack(), public.claim_finish_cards(), public.propose_card_trade(uuid, uuid),
  public.respond_card_trade(uuid, boolean), public.cancel_card_trade(uuid), public.card_rarity(int) to authenticated;

-- ---------- Tiempo real (para enterarte al momento de un intercambio) ----------
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'card_trades') then
    alter publication supabase_realtime add table public.card_trades;
  end if;
exception when undefined_object then
  raise notice 'No existe la publicación supabase_realtime: se omite el tiempo real.';
end;
$$;
