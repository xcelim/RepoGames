# Saga Quest

Tu registro de videojuegos, al estilo de IGN Playlist pero con estética cyberpunk / Persona y seis estéticas más. Guarda lo que juegas, ponle nota, apunta en qué plataforma lo jugaste, escribe tu reseña y organiza tus juegos en bibliotecas (carpetas) públicas o privadas, ordenadas a mano.

## Descargar

**[Última APK para Android](../../releases/latest)**: descarga `SagaQuest.apk` en el móvil y ábrela. Cada push a `main` compila una APK nueva con GitHub Actions.

## Qué hace

- **Biblioteca personal**: cada juego con estado (Lo quiero, Pendiente, Jugando, En pausa, Terminado, 100 %, Abandonado), nota del 1 al 10, plataforma en la que lo juegas, horas, fechas de inicio y fin, «lo tengo», favorito y reseña con lo mejor y lo peor.
- **Listas / bibliotecas**: créalas con nombre, descripción, colores e icono; públicas o privadas; ordénalas a mano con flechas; ordena por lanzamiento, tu nota, duración, título, estado o fecha; filtra por estado, plataforma o texto; selección múltiple para cambiar el estado o quitar varios juegos; compártelas como texto.
- **Bibliotecas oficiales** (públicas): Persona, Fire Emblem, Final Fantasy, The Legend of Zelda, Kirby, Super Mario, Xenoblade y Metroid, con todos sus juegos canónicos en su mejor versión, duración aproximada (HowLongToBeat), sinopsis y consejos. Vienen añadidas a cada perfil nuevo; desde Inicio puedes volver a copiarlas o seguirlas.
- **Comunidad**: las listas públicas de otros usuarios se pueden ver, seguir o copiar a tu perfil («remix»).
- **Cuentas**: varios perfiles en el mismo móvil, cada uno con sus datos. Con Supabase, cuentas reales con correo.
- **Perfil y estadísticas**: juegos, terminados, nota media, horas, gráfica de notas, estados y plataformas.
- **Todos los juegos que existen**: buscador conectado a **IGDB** (unos 300.000 juegos, con portadas, capturas, tráileres, compañías y tiempos para terminarlos) y **RAWG** (más de 500.000 juegos). Se usan las dos a la vez y se quitan duplicados. Las claves son gratis: IGDB en dev.twitch.tv/console y RAWG en rawg.io/apidocs; se pegan en Ajustes.
- **Ficha de juego al estilo IGN**: cabecera con imagen, nota de la crítica, cuánto dura, resumen, capturas, vídeos y detalles. Tu estado, nota, plataforma y reseña se cambian desde el botón «Editar».
- Juegos creados a mano con portada (enlace), horas y sinopsis, editables después.
- **7 estéticas**: Neón, Cozy, Game Boy, Teyvat, Synthwave, Visor HUD y Pastel.
- Copia de seguridad: exporta e importa todos tus datos.

## Conectar Supabase (para que las listas públicas las vea todo el mundo)

1. Crea un proyecto gratis en [supabase.com](https://supabase.com).
2. En **SQL Editor**, ejecuta `supabase/schema.sql` y después `supabase/seed.sql` (el catálogo y las 8 bibliotecas oficiales).
3. En **Project Settings → API**, copia la *Project URL* y la clave *anon public*.
4. En la app: **Ajustes → Nube**, pega las dos y pulsa «Guardar proyecto». Después crea tu cuenta con correo y contraseña: tus datos se suben y, a partir de ahí, se sincronizan solos.

También puedes ponerlas al compilar con un `.env`:

```
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

La clave *anon* es pública por diseño: la seguridad la ponen las políticas Row Level Security del esquema (las listas privadas solo las lee su dueño y nadie puede editar lo de otro).

Tablas: `profiles`, `games`, `lists`, `list_items`, `user_games` (estado, nota, plataforma y reseña de cada usuario) y `list_follows`. Si cambias el catálogo, regenera el seed con `node scripts/generate-seed.js`.

## Desarrollo

```bash
npm install
npx expo start        # Expo Go o build de desarrollo
npm test              # tests de la lógica y del almacén
npx tsc --noEmit      # tipos
npx eslint src        # lint
```

Stack: React Native 0.86 + Expo SDK 57, Expo Router, TypeScript estricto, Zustand con persistencia, Supabase JS, expo-image, expo-secure-store y Jest.

```
src/app          pantallas (cada archivo es una ruta; (tabs) son las pestañas)
src/components   componentes (tarjetas de carpeta, filas de juego, selectores…)
src/store        estado local persistente (perfiles, biblioteca, listas)
src/cloud        Supabase: cliente, conversión de filas y sincronización
src/api          IGDB
src/data         catálogo de sagas y metadatos
src/utils        lógica pura con sus tests
supabase         esquema SQL con RLS y datos iniciales
```
