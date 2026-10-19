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
