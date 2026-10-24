# Base de datos de Saga Quest

Todo vive en Supabase (Postgres) en el esquema `public`. Cada tabla tiene sus normas de acceso (RLS):
cada usuario solo puede leer y cambiar lo que le corresponde.

## Usuarios

| Tabla | Qué guarda |
| --- | --- |
| `profiles` | Cada usuario: nombre, @usuario, color, y en `settings` la foto, el nivel, las vitrinas, los rangos, las tier lists y los duelos. |
| `app_admins` | Quién administra Saga Quest (publica las listas oficiales). |
| `friendships` | Amistades: `requester` pide, `addressee` acepta (`pending` → `accepted`). |

## Juegos

| Tabla | Qué guarda |
| --- | --- |
| `games` | La ficha de cada juego (copiada de IGDB / RAWG, o creada a mano). |
| `user_games` | La biblioteca de cada usuario: estado, nota, plataforma, horas, fechas, reseña, logros marcados y cuántos logros tiene el juego. |

## Listas

| Tabla | Qué guarda |
| --- | --- |
| `lists` | Cada lista: creador (`owner_id`; vacío en las oficiales), nombre, descripción, pública o privada. |
| `list_items` | Los juegos de cada lista, en orden, con la nota y las rejugadas de esa lista. |
| `list_follows` | Los usuarios que han **añadido** la lista a su perfil. No se copia: ven siempre la lista del creador. |
| `list_members` | Colaboradores de las listas cooperativas (pueden cambiar sus juegos y el orden). |
| `lists_overview` | Vista: cada lista con su creador, nº de juegos, nº de usuarios que la han añadido y nº de colaboradores. |

Borrar una lista borra sus juegos, sus seguidores y sus colaboradores (en cascada).

## Mensajes

| Tabla | Qué guarda |
| --- | --- |
| `conversations` | Cada conversación: chat de dos (`direct`) o grupo (`group`, con nombre). |
| `conversation_members` | Quién está en cada conversación, su papel y hasta cuándo ha leído (`last_read_at`). |
| `messages` | Los mensajes, cada uno dentro de su conversación (texto o juego recomendado). |
| `conversations_overview` | Vista: cada conversación con su título, nº de miembros, nº de mensajes y el último. |

Todos los mensajes están en una sola tabla, pero cada uno pertenece a una conversación y hay un índice
por conversación y fecha: es como lo hacen las apps de mensajería, y abrir un chat solo lee los suyos.
Nadie puede leer los mensajes de una conversación en la que no está.

Las funciones `open_direct_chat`, `create_group_chat`, `add_chat_members` y `mark_conversation_read`
son la única forma de crear conversaciones y apuntar los leídos (así nadie se mete en chats ajenos).

## Social

| Tabla | Qué guarda |
| --- | --- |
| `challenges`, `challenge_members` | Retos entre amigos y sus participantes. |
| `reactions` | Reacciones (👍 🔥 😂…) a la actividad de los amigos. |

## Archivo

`legacy_direct_messages`, `legacy_chat_groups`, `legacy_chat_group_members` y `legacy_group_messages` son las
tablas de mensajes de antes de la reorganización. Ya están copiadas en las nuevas y la app no las usa:
se pueden borrar cuando quieras.

## Archivos

- `schema.sql`: la base de datos entera (para un proyecto nuevo). Se puede ejecutar varias veces.
- `migrations/`: los cambios por fecha, para un proyecto que ya existe.
- `functions/games`: servidor intermedio para IGDB, RAWG y Steam (lo usa la web).
