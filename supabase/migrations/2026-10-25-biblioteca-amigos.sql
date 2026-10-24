-- Biblioteca de otra persona: todos sus juegos, también los que tienen la reseña privada
-- (la reseña privada se devuelve vacía). Ejecutar una vez en Supabase → SQL Editor.
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
