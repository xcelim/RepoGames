-- Saga Quest · Amigos y chat (v2.0.29)
-- Pégalo en Supabase → SQL Editor → Run. Se puede ejecutar más de una vez.

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

notify pgrst, 'reload schema';
