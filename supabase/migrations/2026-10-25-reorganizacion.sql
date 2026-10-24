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
