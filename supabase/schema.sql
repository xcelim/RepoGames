-- =====================================================================
-- Saga Quest · base de datos completa para Supabase
-- =====================================================================
-- Cómo usarlo: Supabase → SQL Editor → New query → pega TODO este archivo → Run.
-- Se puede ejecutar todas las veces que quieras: no borra datos y solo añade lo que falte
-- (create ... if not exists, add column if not exists, drop policy if exists...).
-- Después ejecuta seed.sql (las bibliotecas oficiales).
--
-- Qué guarda:
--   profiles      un perfil por usuario de Supabase Auth (+ sus ajustes: estética, duración)
--   games         los juegos que usa alguien (de IGDB, de RAWG o creados a mano)
--   lists         las listas de cada usuario (públicas o privadas) y las oficiales
--   list_items    los juegos de cada lista, con su posición (orden manual)
--   user_games    tu biblioteca: estado, nota, plataforma, horas, fechas, reseña...
--   list_follows  las listas que sigue cada usuario
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Perfiles
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9-]{1,30}$'),
  display_name text not null,
  bio text not null default '',
  avatar_color text not null default '#7b2ff7',
  settings jsonb not null default '{}'::jsonb, -- estética, modo de duración...
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles add column if not exists settings jsonb not null default '{}'::jsonb;
alter table public.profiles add column if not exists updated_at timestamptz not null default now();
alter table public.profiles drop constraint if exists profiles_username_check;
alter table public.profiles add constraint profiles_username_check check (username ~ '^[a-z0-9-]{1,30}$');

-- Al registrarse alguien se crea su perfil automáticamente (con un nombre de usuario libre).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  base text := regexp_replace(lower(coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1))), '[^a-z0-9-]', '', 'g');
  candidate text;
begin
  if base = '' then base := 'jugador'; end if;
  candidate := left(base, 24);
  if exists (select 1 from public.profiles where username = candidate) then
    candidate := left(base, 18) || '-' || substr(new.id::text, 1, 5);
  end if;
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    candidate,
    -- Con Google llegan full_name / name; con correo, el display_name del formulario.
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      base
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 2. Juegos
-- ---------------------------------------------------------------------
create table if not exists public.games (
  id text primary key,               -- 'igdb-1942', 'rawg-3498' o un uuid (creados a mano)
  title text not null,
  year int,
  platforms text not null default '',
  version text,
  series text,
  main numeric,
  extra numeric,
  "full" numeric,
  synopsis text,
  note text,
  igdb_id bigint,
  rawg_id bigint,
  igdb_query text,
  cover_url text,
  developer text,
  release_date date,
  critic_rating smallint,
  source text not null,
  created_by uuid references public.profiles (id) on delete set null, -- null = juego de la API
  created_at timestamptz not null default now()
);
alter table public.games add column if not exists rawg_id bigint;
alter table public.games add column if not exists developer text;
alter table public.games add column if not exists release_date date;
alter table public.games add column if not exists critic_rating smallint;
alter table public.games drop constraint if exists games_source_check;
alter table public.games add constraint games_source_check check (source in ('catalog', 'igdb', 'rawg', 'custom'));

-- ---------------------------------------------------------------------
-- 3. Listas
-- ---------------------------------------------------------------------
create table if not exists public.lists (
  id text primary key,
  owner_id uuid references public.profiles (id) on delete cascade, -- null = oficial
  name text not null,
  description text not null default '',
  visibility text not null default 'private' check (visibility in ('public', 'private')),
  color text not null,
  color2 text not null,
  icon text not null default 'albums',
  forked_from text,                  -- de qué lista es copia (por ejemplo 'official-persona')
  official boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lists_owner_idx on public.lists (owner_id);
create index if not exists lists_public_idx on public.lists (visibility, updated_at desc);

create table if not exists public.list_items (
  id text primary key,
  list_id text not null references public.lists (id) on delete cascade,
  game_id text not null references public.games (id) on delete cascade,
  position int not null,
  added_at timestamptz not null default now()
);
-- Un juego solo puede estar una vez en cada lista.
create unique index if not exists list_items_list_game_key on public.list_items (list_id, game_id);
-- Nota tuya y veces que lo rejugaste dentro de esa lista (por ejemplo, ese año).
alter table public.list_items add column if not exists note text not null default '';
alter table public.list_items add column if not exists replays int not null default 0 check (replays >= 0);
create index if not exists list_items_list_idx on public.list_items (list_id, position);
create index if not exists list_items_game_idx on public.list_items (game_id);

-- ---------------------------------------------------------------------
-- 4. Biblioteca: estado, nota, plataforma, reseña...
-- ---------------------------------------------------------------------
create table if not exists public.user_games (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  game_id text not null references public.games (id) on delete cascade,
  status text not null,
  rating smallint check (rating between 1 and 10),
  platform text,
  liked text[] not null default '{}',
  disliked text[] not null default '{}',
  review text not null default '',
  hours_played numeric,
  started_at date,
  finished_at date,
  owned boolean not null default false,
  favorite boolean not null default false,
  recommend boolean,
  spoilers boolean not null default false,
  review_private boolean not null default false,
  added_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (profile_id, game_id)
);
alter table public.user_games add column if not exists recommend boolean;
alter table public.user_games add column if not exists spoilers boolean not null default false;
alter table public.user_games add column if not exists review_private boolean not null default false;
-- Rejugadas que no están en ninguna lista (el total = suma de las listas + esto).
alter table public.user_games add column if not exists replays_extra int not null default 0;
-- Logros que has marcado (ids de RAWG).
alter table public.user_games add column if not exists achievements text[] not null default '{}';
alter table public.user_games drop constraint if exists user_games_status_check;
alter table public.user_games add constraint user_games_status_check
  check (status in ('library', 'wishlist', 'backlog', 'playing', 'paused', 'beaten', 'completed', 'dropped'));
create index if not exists user_games_game_idx on public.user_games (game_id);

-- ---------------------------------------------------------------------
-- 5. Listas que sigues
-- ---------------------------------------------------------------------
create table if not exists public.list_follows (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  list_id text not null references public.lists (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, list_id)
);

-- ---------------------------------------------------------------------
-- 6. Permisos de la API (por si tu proyecto no da acceso por defecto)
-- ---------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select on public.profiles, public.games, public.lists, public.list_items, public.user_games to anon;
grant select, insert, update, delete on public.profiles, public.games, public.lists, public.list_items,
  public.user_games, public.list_follows to authenticated;

-- ---------------------------------------------------------------------
-- 7. Normas de seguridad (Row Level Security)
--    Sin estas normas cualquiera podría leer o cambiar los datos de otros.
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.games enable row level security;
alter table public.lists enable row level security;
alter table public.list_items enable row level security;
alter table public.user_games enable row level security;
alter table public.list_follows enable row level security;

-- Perfiles: todo el mundo puede verlos; cada uno solo edita el suyo.
drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles for select using (true);
drop policy if exists "profiles write own" on public.profiles;
drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own" on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Juegos: todos pueden verlos. Los de la API (created_by null) los puede añadir o completar
-- cualquier usuario con sesión; los creados a mano, solo quien los creó.
drop policy if exists "games read" on public.games;
create policy "games read" on public.games for select using (true);
drop policy if exists "games insert" on public.games;
create policy "games insert" on public.games for insert to authenticated with check (
  created_by = auth.uid() or (created_by is null and source in ('igdb', 'rawg'))
);
drop policy if exists "games update own" on public.games;
drop policy if exists "games update" on public.games;
create policy "games update" on public.games for update to authenticated
  using (created_by = auth.uid() or (created_by is null and source in ('igdb', 'rawg')))
  with check (created_by = auth.uid() or (created_by is null and source in ('igdb', 'rawg')));
drop policy if exists "games delete own" on public.games;
create policy "games delete own" on public.games for delete to authenticated using (created_by = auth.uid());

-- Listas: las públicas las ve todo el mundo; las privadas, solo su dueño.
-- Nadie puede crear ni tocar las oficiales desde la app.
drop policy if exists "lists read" on public.lists;
create policy "lists read" on public.lists for select
  using (visibility = 'public' or owner_id = auth.uid());
drop policy if exists "lists insert own" on public.lists;
create policy "lists insert own" on public.lists for insert to authenticated
  with check (owner_id = auth.uid() and official = false);
drop policy if exists "lists update own" on public.lists;
create policy "lists update own" on public.lists for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid() and official = false);
drop policy if exists "lists delete own" on public.lists;
create policy "lists delete own" on public.lists for delete to authenticated using (owner_id = auth.uid());

-- Juegos de una lista: visibles si la lista lo es; solo los cambia el dueño de la lista.
drop policy if exists "items read" on public.list_items;
create policy "items read" on public.list_items for select using (
  exists (select 1 from public.lists l where l.id = list_id and (l.visibility = 'public' or l.owner_id = auth.uid()))
);
drop policy if exists "items write own" on public.list_items;
create policy "items write own" on public.list_items for all to authenticated using (
  exists (select 1 from public.lists l where l.id = list_id and l.owner_id = auth.uid())
) with check (
  exists (select 1 from public.lists l where l.id = list_id and l.owner_id = auth.uid())
);

-- Biblioteca y reseñas: las ves todas las tuyas; de los demás, solo las que no son privadas.
drop policy if exists "user_games read" on public.user_games;
create policy "user_games read" on public.user_games for select
  using (profile_id = auth.uid() or review_private = false);
drop policy if exists "user_games write own" on public.user_games;
create policy "user_games write own" on public.user_games for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- Listas que sigues: solo tú las ves y las cambias.
drop policy if exists "follows own" on public.list_follows;
create policy "follows own" on public.list_follows for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- ---------------------------------------------------------------------
-- 8. Borrar tu cuenta desde la app (borra también todos tus datos)
-- ---------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void
language sql
security definer set search_path = public
as $$
  delete from auth.users where id = auth.uid();
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ---------------------------------------------------------------------
-- 9. Tiempo real: si cambias algo en otro móvil, este se entera solo
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['lists', 'list_items', 'user_games', 'list_follows', 'profiles'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
exception when undefined_object then
  raise notice 'No existe la publicación supabase_realtime (¿no es un proyecto de Supabase?): se omite el tiempo real.';
end;
$$;

-- ---------------------------------------------------------------------
-- 10. Amigos y chat
-- ---------------------------------------------------------------------
-- ---------- Amistades ----------
create table if not exists public.friendships (
  requester uuid not null references public.profiles (id) on delete cascade,
  addressee uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (requester, addressee),
  check (requester <> addressee)
);
-- Una sola amistad por pareja, la pida quien la pida.
create unique index if not exists friendships_pair_key
  on public.friendships (least(requester, addressee), greatest(requester, addressee));
create index if not exists friendships_addressee_idx on public.friendships (addressee);

-- ¿Son amigos? (la usa la norma de los mensajes)
create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester = a and f.addressee = b) or (f.requester = b and f.addressee = a))
  );
$$;
revoke all on function public.are_friends(uuid, uuid) from public, anon;
grant execute on function public.are_friends(uuid, uuid) to authenticated;

-- ---------- Mensajes ----------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender uuid not null references public.profiles (id) on delete cascade,
  recipient uuid not null references public.profiles (id) on delete cascade,
  body text not null default '' check (char_length(body) <= 2000),
  game_id text references public.games (id) on delete set null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (sender <> recipient),
  check (char_length(body) > 0 or game_id is not null)
);
create index if not exists messages_pair_idx
  on public.messages (least(sender, recipient), greatest(sender, recipient), created_at desc);
create index if not exists messages_recipient_unread_idx on public.messages (recipient) where read_at is null;

-- Marcar como leídos los mensajes de una conversación (solo los que te han mandado a ti).
create or replace function public.mark_chat_read(other uuid)
returns void
language sql security definer set search_path = public
as $$
  update public.messages set read_at = now()
  where recipient = auth.uid() and sender = other and read_at is null;
$$;
revoke all on function public.mark_chat_read(uuid) from public, anon;
grant execute on function public.mark_chat_read(uuid) to authenticated;

-- ---------- Permisos ----------
grant select, insert, update, delete on public.friendships, public.messages to authenticated;

alter table public.friendships enable row level security;
alter table public.messages enable row level security;

-- Amistades: solo las ven y tocan los dos implicados.
drop policy if exists "friendships read" on public.friendships;
create policy "friendships read" on public.friendships for select to authenticated
  using (auth.uid() in (requester, addressee));
drop policy if exists "friendships request" on public.friendships;
create policy "friendships request" on public.friendships for insert to authenticated
  with check (requester = auth.uid() and status = 'pending');
drop policy if exists "friendships accept" on public.friendships;
create policy "friendships accept" on public.friendships for update to authenticated
  using (addressee = auth.uid()) with check (addressee = auth.uid() and status = 'accepted');
drop policy if exists "friendships remove" on public.friendships;
create policy "friendships remove" on public.friendships for delete to authenticated
  using (auth.uid() in (requester, addressee));

-- Mensajes: solo los ven el que los manda y el que los recibe; solo se escribe a amigos.
drop policy if exists "messages read" on public.messages;
create policy "messages read" on public.messages for select to authenticated
  using (auth.uid() in (sender, recipient));
drop policy if exists "messages send" on public.messages;
create policy "messages send" on public.messages for insert to authenticated
  with check (sender = auth.uid() and read_at is null and public.are_friends(sender, recipient));
drop policy if exists "messages delete own" on public.messages;
create policy "messages delete own" on public.messages for delete to authenticated
  using (sender = auth.uid());

-- ---------- Tiempo real ----------
do $$
declare t text;
begin
  foreach t in array array['friendships', 'messages'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
exception when undefined_object then
  raise notice 'No existe la publicación supabase_realtime: se omite el tiempo real.';
end;
$$;


-- ---------------------------------------------------------------------
-- 11. Listas cooperativas, retos, grupos y reacciones
-- ---------------------------------------------------------------------
-- =====================================================================
-- 1. Listas cooperativas: el dueño añade amigos que pueden editarla
-- =====================================================================
create table if not exists public.list_members (
  list_id text not null references public.lists (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  added_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (list_id, profile_id)
);
create index if not exists list_members_profile_idx on public.list_members (profile_id);

-- Funciones auxiliares (security definer para que las normas no se llamen en bucle).
create or replace function public.is_list_owner(lid text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.lists where id = lid and owner_id = auth.uid());
$$;
create or replace function public.is_list_member(lid text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.list_members where list_id = lid and profile_id = auth.uid());
$$;
create or replace function public.can_view_list(lid text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.lists where id = lid and (visibility = 'public' or owner_id = auth.uid()))
      or exists (select 1 from public.list_members where list_id = lid and profile_id = auth.uid());
$$;
grant execute on function public.is_list_owner(text), public.is_list_member(text), public.can_view_list(text) to anon, authenticated;

alter table public.list_members enable row level security;
grant select on public.list_members to anon;
grant select, insert, delete on public.list_members to authenticated;

drop policy if exists "list_members read" on public.list_members;
create policy "list_members read" on public.list_members for select using (public.can_view_list(list_id));
-- Solo el dueño añade gente, y solo a sus amigos.
drop policy if exists "list_members add" on public.list_members;
create policy "list_members add" on public.list_members for insert to authenticated
  with check (public.is_list_owner(list_id) and added_by = auth.uid() and public.are_friends(auth.uid(), profile_id));
-- El dueño puede quitar a cualquiera; cada uno puede salirse.
drop policy if exists "list_members remove" on public.list_members;
create policy "list_members remove" on public.list_members for delete to authenticated
  using (public.is_list_owner(list_id) or profile_id = auth.uid());

-- Las listas y sus juegos: también las ven y editan los miembros.
drop policy if exists "lists read" on public.lists;
create policy "lists read" on public.lists for select
  using (visibility = 'public' or owner_id = auth.uid() or public.is_list_member(id));
drop policy if exists "items read" on public.list_items;
create policy "items read" on public.list_items for select using (public.can_view_list(list_id));
drop policy if exists "items write own" on public.list_items;
create policy "items write own" on public.list_items for all to authenticated
  using (public.is_list_owner(list_id) or public.is_list_member(list_id))
  with check (public.is_list_owner(list_id) or public.is_list_member(list_id));
-- El nombre, la descripción y la visibilidad los cambia solo el dueño (los miembros, los juegos y el orden).
drop policy if exists "lists update own" on public.lists;
create policy "lists update own" on public.lists for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid() and official = false);

-- =====================================================================
-- 2. Retos entre amigos
-- =====================================================================
create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  creator uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  kind text not null check (kind in ('finish', 'platinum', 'achievements', 'count')),
  game_id text references public.games (id) on delete set null,
  target int, -- para 'count': cuántos juegos terminar
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.challenge_members (
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  accepted boolean not null default false,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (challenge_id, profile_id)
);
create index if not exists challenge_members_profile_idx on public.challenge_members (profile_id);

create or replace function public.is_challenge_member(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.challenge_members where challenge_id = cid and profile_id = auth.uid())
      or exists (select 1 from public.challenges where id = cid and creator = auth.uid());
$$;
grant execute on function public.is_challenge_member(uuid) to authenticated;

alter table public.challenges enable row level security;
alter table public.challenge_members enable row level security;
grant select, insert, update, delete on public.challenges, public.challenge_members to authenticated;

drop policy if exists "challenges read" on public.challenges;
create policy "challenges read" on public.challenges for select to authenticated using (public.is_challenge_member(id));
drop policy if exists "challenges create" on public.challenges;
create policy "challenges create" on public.challenges for insert to authenticated with check (creator = auth.uid());
drop policy if exists "challenges edit" on public.challenges;
create policy "challenges edit" on public.challenges for update to authenticated using (creator = auth.uid()) with check (creator = auth.uid());
drop policy if exists "challenges delete" on public.challenges;
create policy "challenges delete" on public.challenges for delete to authenticated using (creator = auth.uid());

drop policy if exists "challenge_members read" on public.challenge_members;
create policy "challenge_members read" on public.challenge_members for select to authenticated using (public.is_challenge_member(challenge_id));
-- El creador invita (a amigos); cada uno se apunta a sí mismo al aceptar.
drop policy if exists "challenge_members invite" on public.challenge_members;
create policy "challenge_members invite" on public.challenge_members for insert to authenticated with check (
  (profile_id = auth.uid())
  or (exists (select 1 from public.challenges c where c.id = challenge_id and c.creator = auth.uid())
      and public.are_friends(auth.uid(), profile_id))
);
drop policy if exists "challenge_members update self" on public.challenge_members;
create policy "challenge_members update self" on public.challenge_members for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
drop policy if exists "challenge_members leave" on public.challenge_members;
create policy "challenge_members leave" on public.challenge_members for delete to authenticated using (
  profile_id = auth.uid() or exists (select 1 from public.challenges c where c.id = challenge_id and c.creator = auth.uid())
);

-- =====================================================================
-- 3. Chats de grupo
-- =====================================================================
create table if not exists public.chat_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.chat_group_members (
  group_id uuid not null references public.chat_groups (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (group_id, profile_id)
);
create index if not exists chat_group_members_profile_idx on public.chat_group_members (profile_id);
create table if not exists public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.chat_groups (id) on delete cascade,
  sender uuid not null references public.profiles (id) on delete cascade,
  body text not null default '' check (char_length(body) <= 2000),
  game_id text references public.games (id) on delete set null,
  created_at timestamptz not null default now(),
  check (char_length(body) > 0 or game_id is not null)
);
create index if not exists group_messages_group_idx on public.group_messages (group_id, created_at desc);

create or replace function public.is_group_member(gid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.chat_group_members where group_id = gid and profile_id = auth.uid());
$$;
grant execute on function public.is_group_member(uuid) to authenticated;

alter table public.chat_groups enable row level security;
alter table public.chat_group_members enable row level security;
alter table public.group_messages enable row level security;
grant select, insert, update, delete on public.chat_groups, public.chat_group_members, public.group_messages to authenticated;

drop policy if exists "groups read" on public.chat_groups;
create policy "groups read" on public.chat_groups for select to authenticated using (public.is_group_member(id) or created_by = auth.uid());
drop policy if exists "groups create" on public.chat_groups;
create policy "groups create" on public.chat_groups for insert to authenticated with check (created_by = auth.uid());
drop policy if exists "groups rename" on public.chat_groups;
create policy "groups rename" on public.chat_groups for update to authenticated using (public.is_group_member(id)) with check (public.is_group_member(id));
drop policy if exists "groups delete" on public.chat_groups;
create policy "groups delete" on public.chat_groups for delete to authenticated using (created_by = auth.uid());

drop policy if exists "group members read" on public.chat_group_members;
create policy "group members read" on public.chat_group_members for select to authenticated using (public.is_group_member(group_id));
-- Te puedes meter tú al crear el grupo; los miembros meten a sus amigos.
drop policy if exists "group members add" on public.chat_group_members;
create policy "group members add" on public.chat_group_members for insert to authenticated with check (
  (profile_id = auth.uid() and exists (select 1 from public.chat_groups g where g.id = group_id and g.created_by = auth.uid()))
  or (public.is_group_member(group_id) and public.are_friends(auth.uid(), profile_id))
);
drop policy if exists "group members read mark" on public.chat_group_members;
create policy "group members read mark" on public.chat_group_members for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
drop policy if exists "group members leave" on public.chat_group_members;
create policy "group members leave" on public.chat_group_members for delete to authenticated using (profile_id = auth.uid());

drop policy if exists "group messages read" on public.group_messages;
create policy "group messages read" on public.group_messages for select to authenticated using (public.is_group_member(group_id));
drop policy if exists "group messages send" on public.group_messages;
create policy "group messages send" on public.group_messages for insert to authenticated
  with check (sender = auth.uid() and public.is_group_member(group_id));
drop policy if exists "group messages delete own" on public.group_messages;
create policy "group messages delete own" on public.group_messages for delete to authenticated using (sender = auth.uid());

-- =====================================================================
-- 4. Reacciones a la actividad de tus amigos (👍 🔥 😂 😮 ❤️ 🏆)
-- =====================================================================
create table if not exists public.reactions (
  profile_id uuid not null references public.profiles (id) on delete cascade, -- quién reacciona
  target_profile uuid not null references public.profiles (id) on delete cascade, -- de quién es la actividad
  game_id text not null references public.games (id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 8),
  created_at timestamptz not null default now(),
  primary key (profile_id, target_profile, game_id)
);
create index if not exists reactions_target_idx on public.reactions (target_profile, game_id);
alter table public.reactions enable row level security;
grant select, insert, update, delete on public.reactions to authenticated;
drop policy if exists "reactions read" on public.reactions;
create policy "reactions read" on public.reactions for select to authenticated using (
  profile_id = auth.uid() or target_profile = auth.uid()
  or public.are_friends(auth.uid(), target_profile)
);
drop policy if exists "reactions write" on public.reactions;
create policy "reactions write" on public.reactions for all to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid() and (target_profile = auth.uid() or public.are_friends(auth.uid(), target_profile)));

-- =====================================================================
-- 5. Tiempo real
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array['list_members', 'challenges', 'challenge_members', 'chat_groups', 'chat_group_members', 'group_messages', 'reactions'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
exception when undefined_object then
  raise notice 'No existe la publicación supabase_realtime: se omite el tiempo real.';
end;
$$;


-- ---------------------------------------------------------------------
-- 12. Biblioteca de otra persona (también juegos con reseña privada, sin la reseña)
-- ---------------------------------------------------------------------
create or replace function public.user_library(p uuid)
returns setof public.user_games
language plpgsql
stable
security definer set search_path = public
as $$
declare r public.user_games;
begin
  for r in select * from public.user_games where profile_id = p loop
    if r.review_private and r.profile_id is distinct from auth.uid() then
      r.review := '';
    end if;
    return next r;
  end loop;
end;
$$;
revoke all on function public.user_library(uuid) from public;
grant execute on function public.user_library(uuid) to anon, authenticated;
