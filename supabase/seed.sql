-- Generado por scripts/generate-seed.js. No lo edites a mano.
begin;

insert into public.lists (id, owner_id, name, description, visibility, color, color2, icon, official) values
  ('official-persona', null, 'Persona', 'Los juegos canónicos de Persona, cada uno en su mejor versión jugable.', 'public', '#ff2a4d', '#2ef2ff', 'flame', true),
  ('official-fe', null, 'Fire Emblem', 'Los juegos canónicos de Fire Emblem, cada uno en su mejor versión jugable.', 'public', '#f7971e', '#c94b4b', 'shield', true),
  ('official-ff', null, 'Final Fantasy', 'Los juegos canónicos de Final Fantasy, cada uno en su mejor versión jugable.', 'public', '#1e3c72', '#7fd6ff', 'diamond', true),
  ('official-zelda', null, 'The Legend of Zelda', 'Los juegos canónicos de The Legend of Zelda, cada uno en su mejor versión jugable.', 'public', '#2f9e58', '#e8c547', 'triangle', true),
  ('official-kirby', null, 'Kirby', 'Los juegos canónicos de Kirby, cada uno en su mejor versión jugable.', 'public', '#ff8fc8', '#7fd6ff', 'star', true),
  ('official-mario', null, 'Super Mario', 'Los juegos canónicos de Super Mario, cada uno en su mejor versión jugable.', 'public', '#e53935', '#ffd23f', 'flash', true),
  ('official-xeno', null, 'Xenoblade Chronicles', 'Los juegos canónicos de Xenoblade Chronicles, cada uno en su mejor versión jugable.', 'public', '#11998e', '#38ef7d', 'planet', true),
  ('official-metroid', null, 'Metroid', 'Los juegos canónicos de Metroid, cada uno en su mejor versión jugable.', 'public', '#ff7a18', '#7b2ff7', 'rocket', true)
on conflict (id) do update set name = excluded.name, description = excluded.description, color = excluded.color, color2 = excluded.color2, icon = excluded.icon;

commit;
