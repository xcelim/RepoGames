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

-- Los mensajes están en la sección 13 (conversaciones).

-- ---------- Permisos ----------
grant select, insert, update, delete on public.friendships to authenticated;

alter table public.friendships enable row level security;

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

-- ---------- Tiempo real ----------
do $$
declare t text;
begin
  foreach t in array array['friendships'] loop
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

-- 3. Los chats de grupo están en la sección 13 (conversaciones).

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
  foreach t in array array['list_members', 'challenges', 'challenge_members', 'reactions'] loop
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

-- ---------------------------------------------------------------------
-- 13. Reorganización: administradores, listas oficiales, conversaciones y vistas
-- ---------------------------------------------------------------------
-- =====================================================================
-- Saga Quest · Reorganización de la base de datos (octubre 2026)
-- Ejecutar UNA vez en Supabase → SQL Editor, DESPUÉS de instalar la app v2.0.35 o superior.
-- Se puede volver a ejecutar sin problema (no duplica nada).
--
-- Mapa de la base de datos después de esto:
--
--   USUARIOS
--     profiles               cada usuario (nombre, @usuario, foto, nivel, ajustes)
--     app_admins             quién administra Saga Quest (publica las listas oficiales)
--     friendships            amistades y solicitudes
--
--   JUEGOS
--     games                  ficha de cada juego (copia de IGDB / RAWG, o creado a mano)
--     user_games             la biblioteca de cada usuario: estado, nota, horas, logros...
--
--   LISTAS
--     lists                  cada lista: nombre, creador (owner_id), pública/privada, oficial
--     list_items             los juegos de cada lista, en orden (con nota y rejugadas)
--     list_follows           los usuarios que han AÑADIDO la lista a su perfil (sin copiarla)
--     list_members           colaboradores de las listas cooperativas
--     lists_overview         (vista) cada lista con su creador, nº de juegos, de usuarios y de colaboradores
--
--   MENSAJES
--     conversations          cada conversación: chat entre dos ('direct') o grupo ('group')
--     conversation_members   quién está en cada conversación y hasta dónde ha leído
--     messages               los mensajes, cada uno dentro de su conversación
--     conversations_overview (vista) cada conversación con sus miembros y su último mensaje
--
--   SOCIAL
--     challenges, challenge_members   retos entre amigos
--     reactions                       reacciones a la actividad de los amigos
--
--   ARCHIVO (de solo lectura, se pueden borrar cuando quieras)
--     legacy_direct_messages, legacy_chat_groups, legacy_chat_group_members, legacy_group_messages
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Administradores
-- ---------------------------------------------------------------------
create table if not exists public.app_admins (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.app_admins enable row level security;
grant select on public.app_admins to authenticated;
drop policy if exists "admins read own" on public.app_admins;
create policy "admins read own" on public.app_admins for select to authenticated using (profile_id = auth.uid());

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_admins where profile_id = auth.uid());
$$;
grant execute on function public.is_admin() to anon, authenticated;


-- ---------------------------------------------------------------------
-- 2. Listas oficiales (Persona, Fire Emblem, Zelda...) dentro de la base de datos
--    Son filas de "lists" con official = true y sin dueño. Las publica un administrador
--    desde la app; los demás las AÑADEN a su perfil (list_follows), sin copiarlas.
-- ---------------------------------------------------------------------
drop policy if exists "lists official admin" on public.lists;
create policy "lists official admin" on public.lists for all to authenticated
  using (official and owner_id is null and public.is_admin())
  with check (official and owner_id is null and visibility = 'public' and public.is_admin());

drop policy if exists "items official admin" on public.list_items;
create policy "items official admin" on public.list_items for all to authenticated
  using (exists (select 1 from public.lists l where l.id = list_id and l.official and l.owner_id is null) and public.is_admin())
  with check (exists (select 1 from public.lists l where l.id = list_id and l.official and l.owner_id is null) and public.is_admin());

-- Las fichas de juegos de IGDB/RAWG las puede guardar cualquiera (son públicas).


-- ---------------------------------------------------------------------
-- 3. Logros: cuántos tiene cada juego (para que el nivel salga igual en todos los dispositivos)
-- ---------------------------------------------------------------------
alter table public.user_games add column if not exists achievements_total int not null default 0
  check (achievements_total >= 0);


-- ---------------------------------------------------------------------
-- 4. Mensajes: conversaciones + miembros + mensajes
-- ---------------------------------------------------------------------

-- 4.1 Las tablas antiguas pasan al archivo (si existen y aún no se ha hecho).
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'messages' and column_name = 'recipient') then
    alter table public.messages rename to legacy_direct_messages;
  end if;
  if to_regclass('public.group_messages') is not null then
    alter table public.group_messages rename to legacy_group_messages;
  end if;
  if to_regclass('public.chat_group_members') is not null then
    alter table public.chat_group_members rename to legacy_chat_group_members;
  end if;
  if to_regclass('public.chat_groups') is not null then
    alter table public.chat_groups rename to legacy_chat_groups;
  end if;
end;
$$;

-- 4.2 Tablas nuevas
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('direct', 'group')),
  name text check (name is null or char_length(name) between 1 and 60),
  direct_key text unique,             -- en los chats de dos: 'uuid-menor:uuid-mayor'
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  check ((kind = 'direct') = (direct_key is not null))
);
create index if not exists conversations_last_idx on public.conversations (last_message_at desc);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  last_read_at timestamptz not null default now(),  -- ha leído todo lo anterior a esta hora
  primary key (conversation_id, profile_id)
);
create index if not exists conversation_members_profile_idx on public.conversation_members (profile_id);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender uuid references public.profiles (id) on delete set null,
  body text not null default '' check (char_length(body) <= 2000),
  game_id text references public.games (id) on delete set null,  -- juego recomendado
  created_at timestamptz not null default now(),
  check (char_length(body) > 0 or game_id is not null)
);
create index if not exists messages_conversation_idx on public.messages (conversation_id, created_at desc);
create index if not exists messages_sender_idx on public.messages (sender);

-- 4.3 Pasar los mensajes antiguos (solo la primera vez)
do $$
begin
  if to_regclass('public.legacy_direct_messages') is not null then
    -- una conversación por pareja
    insert into public.conversations (kind, direct_key, created_by, created_at, last_message_at)
    select 'direct',
           least(sender, recipient)::text || ':' || greatest(sender, recipient)::text,
           (array_agg(sender order by created_at))[1],
           min(created_at),
           max(created_at)
    from public.legacy_direct_messages
    group by least(sender, recipient), greatest(sender, recipient)
    on conflict (direct_key) do nothing;

    -- los dos miembros, con hasta dónde había leído cada uno
    insert into public.conversation_members (conversation_id, profile_id, role, joined_at, last_read_at)
    select c.id, p.profile_id, 'member', c.created_at,
           coalesce(
             (select max(m.created_at) from public.legacy_direct_messages m
               where m.recipient = p.profile_id and m.read_at is not null
                 and least(m.sender, m.recipient)::text || ':' || greatest(m.sender, m.recipient)::text = c.direct_key),
             c.created_at - interval '1 second')
    from public.conversations c
    cross join lateral (values (split_part(c.direct_key, ':', 1)::uuid), (split_part(c.direct_key, ':', 2)::uuid)) as p(profile_id)
    where c.kind = 'direct'
      and exists (select 1 from public.profiles pr where pr.id = p.profile_id)
    on conflict do nothing;

    insert into public.messages (id, conversation_id, sender, body, game_id, created_at)
    select m.id, c.id, m.sender, m.body, m.game_id, m.created_at
    from public.legacy_direct_messages m
    join public.conversations c
      on c.direct_key = least(m.sender, m.recipient)::text || ':' || greatest(m.sender, m.recipient)::text
    on conflict (id) do nothing;
  end if;

  if to_regclass('public.legacy_chat_groups') is not null then
    insert into public.conversations (id, kind, name, created_by, created_at, last_message_at)
    select g.id, 'group', g.name, g.created_by, g.created_at,
           coalesce((select max(m.created_at) from public.legacy_group_messages m where m.group_id = g.id), g.created_at)
    from public.legacy_chat_groups g
    on conflict (id) do nothing;

    insert into public.conversation_members (conversation_id, profile_id, role, joined_at, last_read_at)
    select gm.group_id, gm.profile_id,
           case when g.created_by = gm.profile_id then 'owner' else 'member' end,
           gm.created_at, gm.last_read_at
    from public.legacy_chat_group_members gm
    join public.legacy_chat_groups g on g.id = gm.group_id
    on conflict do nothing;

    insert into public.messages (id, conversation_id, sender, body, game_id, created_at)
    select m.id, m.group_id, m.sender, m.body, m.game_id, m.created_at
    from public.legacy_group_messages m
    on conflict (id) do nothing;
  end if;
end;
$$;

-- 4.4 El archivo queda de solo lectura para el panel (la app ya no lo usa)
do $$
declare t text;
begin
  foreach t in array array['legacy_direct_messages', 'legacy_chat_groups', 'legacy_chat_group_members', 'legacy_group_messages'] loop
    if to_regclass('public.' || t) is not null then
      execute format('revoke all on public.%I from anon, authenticated', t);
      begin
        execute format('alter publication supabase_realtime drop table public.%I', t);
      exception when others then null;
      end;
    end if;
  end loop;
end;
$$;
drop function if exists public.mark_chat_read(uuid);
drop function if exists public.is_group_member(uuid) cascade;

-- 4.5 Funciones
create or replace function public.is_conversation_member(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.conversation_members where conversation_id = cid and profile_id = auth.uid());
$$;

-- Puedes escribir si estás en la conversación y, si es de dos, si seguís siendo amigos.
create or replace function public.can_post(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_conversation_member(cid) and (
    exists (select 1 from public.conversations c where c.id = cid and c.kind = 'group')
    or exists (
      select 1 from public.conversation_members o
      where o.conversation_id = cid and o.profile_id <> auth.uid() and public.are_friends(auth.uid(), o.profile_id)
    )
  );
$$;

-- Abre (o crea) el chat con un amigo y devuelve su id.
create or replace function public.open_direct_chat(other uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  k text;
  cid uuid;
begin
  if me is null or other is null or other = me then raise exception 'Conversación no válida'; end if;
  if not public.are_friends(me, other) then raise exception 'Solo puedes escribir a tus amigos'; end if;
  k := least(me, other)::text || ':' || greatest(me, other)::text;
  insert into public.conversations (kind, direct_key, created_by) values ('direct', k, me)
  on conflict (direct_key) do nothing;
  select id into cid from public.conversations where direct_key = k;
  insert into public.conversation_members (conversation_id, profile_id) values (cid, me), (cid, other)
  on conflict do nothing;
  return cid;
end;
$$;

-- Crea un grupo contigo y con los amigos que elijas.
create or replace function public.create_group_chat(p_name text, p_members uuid[])
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  cid uuid;
begin
  if me is null then raise exception 'Sin sesión'; end if;
  insert into public.conversations (kind, name, created_by) values ('group', trim(p_name), me) returning id into cid;
  insert into public.conversation_members (conversation_id, profile_id, role) values (cid, me, 'owner');
  insert into public.conversation_members (conversation_id, profile_id)
  select cid, m from unnest(coalesce(p_members, '{}')) as m
  where m <> me and public.are_friends(me, m)
  on conflict do nothing;
  return cid;
end;
$$;

-- Añadir amigos a un grupo en el que estás.
create or replace function public.add_chat_members(cid uuid, p_members uuid[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_conversation_member(cid)
     or not exists (select 1 from public.conversations where id = cid and kind = 'group') then
    raise exception 'No puedes añadir gente a esta conversación';
  end if;
  insert into public.conversation_members (conversation_id, profile_id)
  select cid, m from unnest(coalesce(p_members, '{}')) as m
  where public.are_friends(auth.uid(), m)
  on conflict do nothing;
end;
$$;

-- Marcar como leída una conversación.
create or replace function public.mark_conversation_read(cid uuid)
returns void language sql security definer set search_path = public as $$
  update public.conversation_members set last_read_at = now()
  where conversation_id = cid and profile_id = auth.uid();
$$;

revoke all on function public.open_direct_chat(uuid), public.create_group_chat(text, uuid[]),
  public.add_chat_members(uuid, uuid[]), public.mark_conversation_read(uuid) from public, anon;
grant execute on function public.is_conversation_member(uuid), public.can_post(uuid), public.open_direct_chat(uuid),
  public.create_group_chat(text, uuid[]), public.add_chat_members(uuid, uuid[]), public.mark_conversation_read(uuid)
  to authenticated;

-- Al llegar un mensaje, la conversación sube arriba.
create or replace function public.touch_conversation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  return new;
end;
$$;
drop trigger if exists messages_touch_conversation on public.messages;
create trigger messages_touch_conversation after insert on public.messages
  for each row execute function public.touch_conversation();

-- 4.6 Permisos
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
revoke all on public.conversations, public.conversation_members, public.messages from anon;
grant select, update, delete on public.conversations to authenticated;
grant select, delete on public.conversation_members to authenticated;
grant select, insert, delete on public.messages to authenticated;

drop policy if exists "conversations read" on public.conversations;
create policy "conversations read" on public.conversations for select to authenticated
  using (public.is_conversation_member(id));
drop policy if exists "conversations rename group" on public.conversations;
create policy "conversations rename group" on public.conversations for update to authenticated
  using (kind = 'group' and public.is_conversation_member(id))
  with check (kind = 'group' and public.is_conversation_member(id));
drop policy if exists "conversations delete group" on public.conversations;
create policy "conversations delete group" on public.conversations for delete to authenticated
  using (kind = 'group' and created_by = auth.uid());

drop policy if exists "members read" on public.conversation_members;
create policy "members read" on public.conversation_members for select to authenticated
  using (public.is_conversation_member(conversation_id));
drop policy if exists "members leave group" on public.conversation_members;
create policy "members leave group" on public.conversation_members for delete to authenticated
  using (profile_id = auth.uid()
         and exists (select 1 from public.conversations c where c.id = conversation_id and c.kind = 'group'));

drop policy if exists "messages read" on public.messages;
create policy "messages read" on public.messages for select to authenticated
  using (public.is_conversation_member(conversation_id));
drop policy if exists "messages send" on public.messages;
create policy "messages send" on public.messages for insert to authenticated
  with check (sender = auth.uid() and public.can_post(conversation_id));
drop policy if exists "messages delete own" on public.messages;
create policy "messages delete own" on public.messages for delete to authenticated
  using (sender = auth.uid());

-- 4.7 Tiempo real
do $$
declare t text;
begin
  foreach t in array array['conversations', 'conversation_members', 'messages'] loop
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
-- 5. Vistas para mirar los datos cómodamente en el panel
-- ---------------------------------------------------------------------
create or replace view public.lists_overview with (security_invoker = true) as
select l.id,
       l.name,
       case when l.official then 'Saga Quest' else p.username end as creator,
       l.owner_id,
       l.official,
       l.visibility,
       (select count(*) from public.list_items i where i.list_id = l.id) as games,
       (select count(*) from public.list_follows f where f.list_id = l.id) as added_by_users,
       (select count(*) from public.list_members m where m.list_id = l.id) as collaborators,
       l.created_at,
       l.updated_at
from public.lists l
left join public.profiles p on p.id = l.owner_id;
grant select on public.lists_overview to anon, authenticated;

create or replace view public.conversations_overview with (security_invoker = true) as
select c.id,
       c.kind,
       coalesce(c.name, (select string_agg(p.username, ' y ' order by p.username)
                         from public.conversation_members cm join public.profiles p on p.id = cm.profile_id
                         where cm.conversation_id = c.id)) as title,
       (select count(*) from public.conversation_members cm where cm.conversation_id = c.id) as members,
       (select count(*) from public.messages m where m.conversation_id = c.id) as messages,
       c.last_message_at,
       c.created_at
from public.conversations c;
grant select on public.conversations_overview to authenticated;


-- ---------------------------------------------------------------------
-- 6. Descripciones (se ven en el panel de Supabase)
-- ---------------------------------------------------------------------
comment on table public.profiles is 'Usuarios: nombre, @usuario, foto, nivel y ajustes (settings).';
comment on table public.app_admins is 'Administradores de Saga Quest (pueden publicar las listas oficiales).';
comment on table public.friendships is 'Amistades: requester pide, addressee acepta (status pending/accepted).';
comment on table public.games is 'Ficha de cada juego (copia de IGDB/RAWG o creado a mano).';
comment on table public.user_games is 'Biblioteca de cada usuario: estado, nota, horas, fechas, reseña y logros.';
comment on table public.lists is 'Listas: creador (owner_id; vacío = oficial), nombre y visibilidad.';
comment on table public.list_items is 'Juegos de cada lista, en orden, con nota y rejugadas.';
comment on table public.list_follows is 'Usuarios que han añadido una lista a su perfil (sin copiarla).';
comment on table public.list_members is 'Colaboradores de las listas cooperativas.';
comment on table public.conversations is 'Conversaciones: chat de dos (direct) o grupo (group).';
comment on table public.conversation_members is 'Quién está en cada conversación y hasta cuándo ha leído (last_read_at).';
comment on table public.messages is 'Mensajes, cada uno dentro de su conversación.';
comment on table public.challenges is 'Retos entre amigos.';
comment on table public.challenge_members is 'Participantes de cada reto.';
comment on table public.reactions is 'Reacciones a la actividad de los amigos.';
comment on view public.lists_overview is 'Cada lista con su creador, nº de juegos, de usuarios que la han añadido y de colaboradores.';
comment on view public.conversations_overview is 'Cada conversación con sus miembros y su último mensaje.';

-- ---------------------------------------------------------------------
-- 14. Cromos (sobre diario, cromo al terminar un juego e intercambios)
-- ---------------------------------------------------------------------
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
