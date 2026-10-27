-- =====================================================================
-- Seguridad para publicar la app (28/10/2026)
--   1. Tamaños máximos (nadie puede meter textos o ajustes gigantes)
--   2. Límites de ritmo (nadie puede crear 800 juegos, listas o mensajes de golpe)
--   3. Bloquear y denunciar usuarios
--   4. Configuración de la app (versión mínima: actualizaciones obligatorias)
-- Se puede ejecutar varias veces sin problema. Si eres administrador (o usas la clave de
-- servicio desde el panel), los límites de ritmo no te afectan.
-- =====================================================================

-- ---------- 1. Tamaños máximos ----------
-- «not valid»: no se revisan los datos que ya hay, solo lo nuevo que se guarde.
do $$
declare
  c record;
begin
  for c in select * from (values
    ('profiles', 'profiles_sizes', 'char_length(username) <= 40 and char_length(display_name) <= 60 and char_length(coalesce(bio, '''')) <= 1000 and pg_column_size(settings) <= 600000'),
    ('games', 'games_sizes', 'char_length(id) <= 120 and char_length(title) <= 300 and char_length(coalesce(platforms, '''')) <= 1000 and char_length(coalesce(synopsis, '''')) <= 20000 and char_length(coalesce(note, '''')) <= 5000 and char_length(coalesce(cover_url, '''')) <= 2000 and char_length(coalesce(developer, '''')) <= 300'),
    ('lists', 'lists_sizes', 'char_length(id) <= 120 and char_length(name) <= 120 and char_length(coalesce(description, '''')) <= 5000'),
    ('list_items', 'list_items_sizes', 'char_length(coalesce(note, '''')) <= 5000'),
    ('user_games', 'user_games_sizes', 'char_length(coalesce(review, '''')) <= 20000 and char_length(coalesce(platform, '''')) <= 200 and coalesce(cardinality(achievements), 0) <= 5000 and coalesce(cardinality(liked), 0) <= 100 and coalesce(cardinality(disliked), 0) <= 100'),
    ('challenges', 'challenges_sizes', 'char_length(coalesce(title, '''')) <= 200')
  ) as t(tbl, name, expr)
  loop
    if to_regclass('public.' || c.tbl) is not null
       and not exists (select 1 from pg_constraint where conname = c.name) then
      execute format('alter table public.%I add constraint %I check (%s) not valid', c.tbl, c.name, c.expr);
    end if;
  end loop;
end $$;

-- ---------- 2. Límites de ritmo ----------
-- Quién ha añadido cada juego (para poder limitarlo), aunque sea un juego de la API.
alter table public.games add column if not exists added_by uuid default auth.uid();
create index if not exists games_added_by_idx on public.games (added_by, created_at);
create index if not exists lists_owner_created_idx on public.lists (owner_id, created_at);
create index if not exists friendships_requester_created_idx on public.friendships (requester, created_at);
create index if not exists messages_sender_created_idx on public.messages (sender, created_at);
create index if not exists challenges_creator_created_idx on public.challenges (creator, created_at);
create index if not exists conversations_creator_created_idx on public.conversations (created_by, created_at);
create index if not exists list_items_list_idx on public.list_items (list_id);

create or replace function public.too_many(msg text)
returns void language plpgsql as $$
begin
  raise exception using errcode = 'P0429', message = msg;
end;
$$;

-- Comprueba los límites antes de guardar algo nuevo.
create or replace function public.rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  n int;
begin
  if me is null or public.is_admin() then
    return new;
  end if;
  -- Al guardar algo que ya existía (la app sube con «upsert») no es nuevo: no cuenta.
  -- (Cada tabla por separado: plpgsql no deja mirar campos que la fila no tiene.)
  if tg_table_name = 'games' then
    if exists (select 1 from public.games where id = new.id) then return new; end if;
  elsif tg_table_name = 'lists' then
    if exists (select 1 from public.lists where id = new.id) then return new; end if;
  elsif tg_table_name = 'list_items' then
    if exists (select 1 from public.list_items where id = new.id) then return new; end if;
  elsif tg_table_name = 'user_games' then
    if exists (select 1 from public.user_games where profile_id = new.profile_id and game_id = new.game_id) then
      return new;
    end if;
  elsif tg_table_name = 'friendships' then
    if exists (select 1 from public.friendships where requester = new.requester and addressee = new.addressee) then
      return new;
    end if;
  end if;
  if tg_table_name = 'games' then
    new.added_by := me;
    if new.source = 'custom' then
      select count(*) into n from public.games
        where added_by = me and source = 'custom' and created_at > now() - interval '1 day';
      if n >= 30 then perform public.too_many('Has creado muchos juegos hoy. Vuelve a intentarlo mañana.'); end if;
    end if;
    select count(*) into n from public.games where added_by = me and created_at > now() - interval '1 hour';
    if n >= 3000 then perform public.too_many('Demasiados juegos nuevos en poco tiempo. Espera un rato.'); end if;
  elsif tg_table_name = 'lists' then
    select count(*) into n from public.lists where owner_id = me and created_at > now() - interval '1 day';
    if n >= 100 then perform public.too_many('Has creado muchas listas hoy. Vuelve a intentarlo mañana.'); end if;
    select count(*) into n from public.lists where owner_id = me;
    if n >= 2000 then perform public.too_many('Has llegado al máximo de listas.'); end if;
  elsif tg_table_name = 'list_items' then
    select count(*) into n from public.list_items where list_id = new.list_id;
    if n >= 5000 then perform public.too_many('Esta lista ya tiene el máximo de juegos.'); end if;
  elsif tg_table_name = 'user_games' then
    select count(*) into n from public.user_games where profile_id = me;
    if n >= 30000 then perform public.too_many('Has llegado al máximo de juegos en tu biblioteca.'); end if;
  elsif tg_table_name = 'friendships' then
    select count(*) into n from public.friendships where requester = me and created_at > now() - interval '1 day';
    if n >= 60 then perform public.too_many('Has enviado muchas solicitudes de amistad hoy.'); end if;
  elsif tg_table_name = 'messages' then
    select count(*) into n from public.messages where sender = me and created_at > now() - interval '1 minute';
    if n >= 40 then perform public.too_many('Vas muy rápido: espera un momento antes de seguir escribiendo.'); end if;
    select count(*) into n from public.messages where sender = me and created_at > now() - interval '1 day';
    if n >= 3000 then perform public.too_many('Has enviado muchos mensajes hoy.'); end if;
  elsif tg_table_name = 'challenges' then
    select count(*) into n from public.challenges where creator = me and created_at > now() - interval '1 day';
    if n >= 30 then perform public.too_many('Has creado muchos retos hoy.'); end if;
  elsif tg_table_name = 'conversations' then
    select count(*) into n from public.conversations
      where created_by = me and kind = 'group' and created_at > now() - interval '1 day';
    if new.kind = 'group' and n >= 20 then perform public.too_many('Has creado muchos grupos hoy.'); end if;
  elsif tg_table_name = 'card_trades' then
    select count(*) into n from public.card_trades where from_profile = me and created_at > now() - interval '1 day';
    if n >= 60 then perform public.too_many('Has propuesto muchos intercambios hoy.'); end if;
  elsif tg_table_name = 'reports' then
    select count(*) into n from public.reports where reporter = me and created_at > now() - interval '1 day';
    if n >= 30 then perform public.too_many('Has enviado muchas denuncias hoy.'); end if;
  end if;
  return new;
end;
$$;

-- ---------- 3. Bloquear y denunciar ----------
create table if not exists public.user_blocks (
  blocker uuid not null references public.profiles (id) on delete cascade,
  blocked uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);
alter table public.user_blocks enable row level security;
grant select, insert, delete on public.user_blocks to authenticated;
drop policy if exists "blocks own" on public.user_blocks;
create policy "blocks own" on public.user_blocks for all to authenticated
  using (blocker = auth.uid()) with check (blocker = auth.uid());

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  target_profile uuid references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('user', 'review', 'list', 'message', 'game', 'other')),
  target_id text check (char_length(target_id) <= 200),
  reason text not null default '' check (char_length(reason) <= 1000),
  status text not null default 'open' check (status in ('open', 'done', 'dismissed')),
  created_at timestamptz not null default now()
);
create index if not exists reports_status_idx on public.reports (status, created_at desc);
create index if not exists reports_reporter_idx on public.reports (reporter, created_at);
alter table public.reports enable row level security;
grant select, insert, update on public.reports to authenticated;
drop policy if exists "reports send" on public.reports;
create policy "reports send" on public.reports for insert to authenticated
  with check (reporter = auth.uid() and status = 'open');
drop policy if exists "reports read" on public.reports;
create policy "reports read" on public.reports for select to authenticated
  using (reporter = auth.uid() or public.is_admin());
drop policy if exists "reports manage" on public.reports;
create policy "reports manage" on public.reports for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ¿Alguno de los dos ha bloqueado al otro?
create or replace function public.is_blocked(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_blocks
    where (blocker = a and blocked = b) or (blocker = b and blocked = a)
  );
$$;

-- Al bloquear a alguien se deshace la amistad (y las solicitudes) entre los dos.
create or replace function public.on_block()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.friendships
    where (requester = new.blocker and addressee = new.blocked)
       or (requester = new.blocked and addressee = new.blocker);
  return new;
end;
$$;
drop trigger if exists on_block on public.user_blocks;
create trigger on_block after insert on public.user_blocks for each row execute function public.on_block();

-- Nadie bloqueado puede pedirte amistad ni escribirte.
drop policy if exists "friendships request" on public.friendships;
create policy "friendships request" on public.friendships for insert to authenticated
  with check (requester = auth.uid() and status = 'pending' and not public.is_blocked(requester, addressee));

create or replace function public.can_post(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_conversation_member(cid) and (
    exists (select 1 from public.conversations c where c.id = cid and c.kind = 'group')
    or exists (
      select 1 from public.conversation_members o
      where o.conversation_id = cid and o.profile_id <> auth.uid()
        and public.are_friends(auth.uid(), o.profile_id)
        and not public.is_blocked(auth.uid(), o.profile_id)
    )
  );
$$;

-- ---------- 4. Configuración de la app ----------
-- min_build: compilaciones más viejas tienen que actualizar sí o sí (0 = ninguna).
create table if not exists public.app_config (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.app_config enable row level security;
grant select on public.app_config to anon, authenticated;
grant insert, update, delete on public.app_config to authenticated;
drop policy if exists "config read" on public.app_config;
create policy "config read" on public.app_config for select using (true);
drop policy if exists "config admin" on public.app_config;
create policy "config admin" on public.app_config for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
insert into public.app_config (key, value)
values ('min_build', '{"build": 0, "message": ""}'::jsonb)
on conflict (key) do nothing;

-- Los límites de ritmo, en cada tabla.
do $$
declare
  t text;
begin
  foreach t in array array['games', 'lists', 'list_items', 'user_games', 'friendships', 'messages',
                           'challenges', 'conversations', 'card_trades', 'reports']
  loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists rate_limit on public.%I', t);
      execute format('create trigger rate_limit before insert on public.%I for each row execute function public.rate_limit()', t);
    end if;
  end loop;
end $$;

-- Las funciones internas no se llaman desde fuera.
revoke execute on function public.too_many(text) from public, anon, authenticated;
revoke execute on function public.rate_limit() from public, anon, authenticated;
revoke execute on function public.on_block() from public, anon, authenticated;
