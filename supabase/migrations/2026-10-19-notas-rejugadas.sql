-- Saga Quest · Notas, rejugadas y logros (v2.0.24)
-- Pégalo en Supabase → SQL Editor → Run. Se puede ejecutar más de una vez.
alter table public.list_items add column if not exists note text not null default '';
alter table public.list_items add column if not exists replays int not null default 0;
alter table public.user_games add column if not exists replays_extra int not null default 0;
alter table public.user_games add column if not exists achievements text[] not null default '{}';
do $$ begin
  alter table public.list_items add constraint list_items_replays_check check (replays >= 0);
exception when duplicate_object then null;
end $$;
-- Que la API vea las columnas nuevas al momento.
notify pgrst, 'reload schema';
