-- Saga Quest · esquema de Supabase
-- Ejecuta este archivo en el SQL Editor de tu proyecto y después seed.sql.
-- Las columnas coinciden con los tipos de src/types.ts (en snake_case).

-- ---------- Perfiles (uno por usuario de Supabase Auth) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9-]{1,24}$'),
  display_name text not null,
  bio text not null default '',
  avatar_color text not null default '#7b2ff7',
  created_at timestamptz not null default now()
);

-- Al registrarse se crea su perfil automáticamente.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  base text := regexp_replace(lower(coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1))), '[^a-z0-9-]', '', 'g');
begin
  if base = '' then base := 'jugador'; end if;
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    left(base, 18) || '-' || substr(new.id::text, 1, 5),
    coalesce(new.raw_user_meta_data ->> 'display_name', base)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Juegos (catálogo, IGDB y creados a mano) ----------
create table if not exists public.games (
  id text primary key,
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
  source text not null check (source in ('catalog', 'igdb', 'rawg', 'custom')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------- Listas (bibliotecas / carpetas) ----------
create table if not exists public.lists (
  id text primary key,
  owner_id uuid references public.profiles (id) on delete cascade, -- null = oficial
  name text not null,
  description text not null default '',
  visibility text not null default 'private' check (visibility in ('public', 'private')),
  color text not null,
  color2 text not null,
  icon text not null default 'albums',
  forked_from text,
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
  added_at timestamptz not null default now(),
  unique (list_id, game_id)
);
create index if not exists list_items_list_idx on public.list_items (list_id, position);

-- ---------- Tu biblioteca: estado, nota, plataforma y reseña de cada juego ----------
create table if not exists public.user_games (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  game_id text not null references public.games (id) on delete cascade,
  status text not null check (status in ('library', 'wishlist', 'backlog', 'playing', 'paused', 'beaten', 'completed', 'dropped')),
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

create table if not exists public.list_follows (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  list_id text not null references public.lists (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, list_id)
);

-- ---------- Seguridad: Row Level Security ----------
alter table public.profiles enable row level security;
alter table public.games enable row level security;
alter table public.lists enable row level security;
alter table public.list_items enable row level security;
alter table public.user_games enable row level security;
alter table public.list_follows enable row level security;

-- Perfiles: todos pueden verlos; cada uno edita el suyo.
drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles for select using (true);
drop policy if exists "profiles write own" on public.profiles;
create policy "profiles write own" on public.profiles for insert with check (id = auth.uid());
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles for update using (id = auth.uid());

-- Juegos: todos pueden verlos; los usuarios añaden y editan los suyos.
drop policy if exists "games read" on public.games;
create policy "games read" on public.games for select using (true);
drop policy if exists "games insert" on public.games;
create policy "games insert" on public.games for insert with check (created_by = auth.uid());
drop policy if exists "games update own" on public.games;
create policy "games update own" on public.games for update using (created_by = auth.uid());

-- Listas: las públicas las ve todo el mundo; las privadas, solo su dueño.
drop policy if exists "lists read" on public.lists;
create policy "lists read" on public.lists for select
  using (visibility = 'public' or owner_id = auth.uid());
drop policy if exists "lists insert own" on public.lists;
create policy "lists insert own" on public.lists for insert
  with check (owner_id = auth.uid() and official = false);
drop policy if exists "lists update own" on public.lists;
create policy "lists update own" on public.lists for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid() and official = false);
drop policy if exists "lists delete own" on public.lists;
create policy "lists delete own" on public.lists for delete using (owner_id = auth.uid());

-- Juegos de una lista: visibles si la lista lo es; editables por su dueño.
drop policy if exists "items read" on public.list_items;
create policy "items read" on public.list_items for select using (
  exists (select 1 from public.lists l where l.id = list_id and (l.visibility = 'public' or l.owner_id = auth.uid()))
);
drop policy if exists "items write own" on public.list_items;
create policy "items write own" on public.list_items for all using (
  exists (select 1 from public.lists l where l.id = list_id and l.owner_id = auth.uid())
) with check (
  exists (select 1 from public.lists l where l.id = list_id and l.owner_id = auth.uid())
);

-- Biblioteca y reseñas: públicas para leer (como en un perfil), solo editables por su dueño.
drop policy if exists "user_games read" on public.user_games;
create policy "user_games read" on public.user_games for select using (true);
drop policy if exists "user_games write own" on public.user_games;
create policy "user_games write own" on public.user_games for all
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

drop policy if exists "follows own" on public.list_follows;
create policy "follows own" on public.list_follows for all
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- Migración para bases creadas con la versión 2.0 (no hace nada si ya existe).
alter table public.games add column if not exists rawg_id bigint;
alter table public.games drop constraint if exists games_source_check;
alter table public.games add constraint games_source_check check (source in ('catalog', 'igdb', 'rawg', 'custom'));

-- Migración a la versión 3 (pantallas estilo IGN).
alter table public.games add column if not exists developer text;
alter table public.games add column if not exists release_date date;
alter table public.games add column if not exists critic_rating smallint;
alter table public.user_games add column if not exists recommend boolean;
alter table public.user_games add column if not exists spoilers boolean not null default false;
alter table public.user_games add column if not exists review_private boolean not null default false;
alter table public.user_games drop constraint if exists user_games_status_check;
alter table public.user_games add constraint user_games_status_check
  check (status in ('library', 'wishlist', 'backlog', 'playing', 'paused', 'beaten', 'completed', 'dropped'));
