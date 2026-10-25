-- Estado «Visto»: juegos que has visto (en vídeo o en directo) en vez de jugarlos.
-- Se puede ejecutar varias veces sin problema.
alter table public.user_games drop constraint if exists user_games_status_check;
alter table public.user_games add constraint user_games_status_check
  check (status in ('library', 'wishlist', 'backlog', 'playing', 'paused', 'beaten', 'completed', 'watched', 'dropped'));
