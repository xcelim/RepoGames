-- Arreglo: la app podía mandar algunos campos vacíos (null) al guardar varios juegos a la vez
-- y la base de datos los rechazaba («null value in column "replays_extra"...»), así que esos
-- juegos no llegaban a tu cuenta. Con esto se rellenan solos con su valor por defecto.
-- Incluye también el estado «Visto». Se puede ejecutar varias veces sin problema.

-- Por si faltan columnas de SQL anteriores.
alter table public.user_games add column if not exists replays_extra int not null default 0;
alter table public.user_games add column if not exists achievements text[] not null default '{}';
alter table public.user_games add column if not exists achievements_total int not null default 0;
alter table public.list_items add column if not exists note text not null default '';
alter table public.list_items add column if not exists replays int not null default 0;

create or replace function public.user_games_fill_defaults()
returns trigger
language plpgsql
as $$
begin
  new.liked := coalesce(new.liked, '{}');
  new.disliked := coalesce(new.disliked, '{}');
  new.review := coalesce(new.review, '');
  new.owned := coalesce(new.owned, false);
  new.favorite := coalesce(new.favorite, false);
  new.spoilers := coalesce(new.spoilers, false);
  new.review_private := coalesce(new.review_private, false);
  new.replays_extra := coalesce(new.replays_extra, 0);
  new.achievements := coalesce(new.achievements, '{}');
  new.achievements_total := coalesce(new.achievements_total, 0);
  new.added_at := coalesce(new.added_at, now());
  new.updated_at := coalesce(new.updated_at, now());
  return new;
end;
$$;

drop trigger if exists user_games_fill_defaults on public.user_games;
create trigger user_games_fill_defaults
  before insert or update on public.user_games
  for each row execute function public.user_games_fill_defaults();

-- Lo mismo para los juegos de las listas (nota y rejugadas).
create or replace function public.list_items_fill_defaults()
returns trigger
language plpgsql
as $$
begin
  new.note := coalesce(new.note, '');
  new.replays := coalesce(new.replays, 0);
  return new;
end;
$$;

drop trigger if exists list_items_fill_defaults on public.list_items;
create trigger list_items_fill_defaults
  before insert or update on public.list_items
  for each row execute function public.list_items_fill_defaults();

-- Estado «Visto».
alter table public.user_games drop constraint if exists user_games_status_check;
alter table public.user_games add constraint user_games_status_check
  check (status in ('library', 'wishlist', 'backlog', 'playing', 'paused', 'beaten', 'completed', 'watched', 'dropped'));
