-- Generado por scripts/generate-seed.js. No lo edites a mano.
begin;

insert into public.lists (id, owner_id, name, description, visibility, color, color2, icon, official) values
  ('official-persona', null, 'Persona', 'Todos los juegos de la serie Persona, en orden de lanzamiento.', 'public', '#ff2a4d', '#2ef2ff', 'flame', true),
  ('official-fe', null, 'Fire Emblem', 'Todos los juegos de la serie Fire Emblem, en orden de lanzamiento.', 'public', '#f7971e', '#c94b4b', 'shield', true),
  ('official-ff', null, 'Final Fantasy', 'Todos los juegos de la serie Final Fantasy, en orden de lanzamiento.', 'public', '#1e3c72', '#7fd6ff', 'diamond', true),
  ('official-zelda', null, 'The Legend of Zelda', 'Todos los juegos de la serie The Legend of Zelda, en orden de lanzamiento.', 'public', '#2f9e58', '#e8c547', 'triangle', true),
  ('official-kirby', null, 'Kirby', 'Todos los juegos de la serie Kirby, en orden de lanzamiento.', 'public', '#ff8fc8', '#7fd6ff', 'star', true),
  ('official-mario', null, 'Super Mario', 'Todos los juegos de la serie Super Mario, en orden de lanzamiento.', 'public', '#e53935', '#ffd23f', 'flash', true),
  ('official-xeno', null, 'Xenoblade Chronicles', 'Todos los juegos de la serie Xenoblade Chronicles, en orden de lanzamiento.', 'public', '#11998e', '#38ef7d', 'planet', true),
  ('official-metroid', null, 'Metroid', 'Todos los juegos de la serie Metroid, en orden de lanzamiento.', 'public', '#ff7a18', '#7b2ff7', 'rocket', true)
on conflict (id) do update set name = excluded.name, description = excluded.description, color = excluded.color, color2 = excluded.color2, icon = excluded.icon;

commit;
