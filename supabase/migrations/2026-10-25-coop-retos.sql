-- Saga Quest · Listas cooperativas, retos, grupos y reacciones (v2.0.30)
-- Pégalo en Supabase → SQL Editor → Run. Se puede ejecutar más de una vez.
-- (Necesita haber ejecutado antes el de amigos y chat: 2026-10-24-social.sql)

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

notify pgrst, 'reload schema';
