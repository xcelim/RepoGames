# Saga Quest

Tu registro de videojuegos, al estilo de IGN Playlist pero con estética cyberpunk / Persona y seis estéticas más. Guarda lo que juegas, ponle nota, apunta en qué plataforma lo jugaste, escribe tu reseña y organiza tus juegos en bibliotecas (carpetas) públicas o privadas, ordenadas a mano.

## Descargar

**[Última APK para Android](../../releases/latest)**: descarga `SagaQuest.apk` en el móvil y ábrela. Cada push a `main` compila una APK nueva con GitHub Actions.

## Qué hace

Funciona como **IGN Playlist** (mismas pantallas, menús y navegación) con las estéticas de Saga Quest.

- **4 pestañas como IGN**: Descubrir, Biblioteca, Listas y Perfil. Títulos grandes que se encogen al bajar.
- **Descubrir**: listas destacadas (las canónicas de cada saga), mejor valorados del año, lo que se juega esta semana (numerado), próximos lanzamientos y listas de la comunidad. Botón «Añadir ⊕» en cada portada.
- **Biblioteca**: «Jugando ahora» y la tarjeta de estados (Mis juegos, Deseados, Pendientes, Jugando, En pausa, Terminados, Abandonados) con su contador; cada una abre su rejilla con orden.
- **Listas**: actualizadas recientemente (mosaico de portadas), Mis listas y Listas que sigues. Cada lista: cabecera con mosaico, autor, desplegable «Ordenar» con las 13 ordenaciones de IGN (orden del autor, actualizados, A-Z, Z-A, nota de la crítica, lanzamiento, duración y tus notas, en los dos sentidos), estadísticas (juegos · horas · pública/privada) y rejilla de 2 columnas con número y estado.
- **Editar lista**: ajustes plegables y juegos que se reordenan **arrastrando el asa**.
- **Ficha de juego**: portada con su estado, nota de la crítica, tu nota, nota de los jugadores, «Editar estado» y «•••» (organizar en listas, plataforma, reseña, más detalles, compartir y atajos de estado). Pestañas Resumen (cuánto dura, tu partida, tu reseña, imágenes y vídeo, datos), Listas y Reseñas.
- **Reseña en 5 pasos** como IGN: nota del 1 al 10 con barra, recomendar, plataforma, qué te gustó y qué no, texto con spoilers, resumen con opción privada y pantalla para compartir.
- **Buscador tolerante**: encuentra el juego aunque escribas mal o a medias («minecraf», «fire emblem blazing blaze», «zelda breath wild»). Busca de varias maneras en IGDB y RAWG a la vez y ordena por parecido.
- **Bibliotecas oficiales** (públicas): Persona, Fire Emblem, Final Fantasy, The Legend of Zelda, Kirby, Super Mario, Xenoblade y Metroid. Solo los canónicos, en su mejor versión jugable (src/data/canon.ts); todos los datos llegan de la API.
- **Comunidad**: las listas públicas de otros se pueden seguir o copiar a tu perfil.
- **Cuentas**: varios perfiles en el mismo móvil y, con Supabase, cuentas reales.
- **Todos los juegos que existen**: API de **IGDB** y **RAWG** con las claves dentro de la app.
- Juegos creados a mano, **7 estéticas** y copia de seguridad.

## Claves de la API (solo una vez, para quien compila)

En GitHub: **Settings → Secrets and variables → Actions → New repository secret**:

| Nombre | Valor |
| --- | --- |
| `IGDB_CLIENT_ID` | Client ID de tu aplicación en dev.twitch.tv/console |
| `IGDB_CLIENT_SECRET` | Client Secret de esa aplicación |
| `RAWG_KEY` | clave de rawg.io/apidocs |

GitHub Actions las mete en la APK al compilar. Para compilar en local, ponlas en un `.env` como `EXPO_PUBLIC_IGDB_CLIENT_ID`, `EXPO_PUBLIC_IGDB_CLIENT_SECRET` y `EXPO_PUBLIC_RAWG_KEY`.

Si vas a publicar la app para otra gente, mejor no meter las claves en la APK (se pueden extraer): despliega `supabase/functions/games` (un servidor intermedio que guarda las claves) y añade solo el secreto `GAMES_PROXY_URL` con su dirección. Instrucciones dentro del archivo.

## Base de datos (Supabase)

Todo se guarda en Supabase: tu perfil y tus ajustes, tus listas (públicas y privadas) con su orden, tu biblioteca (estado, nota, plataforma, horas, fechas, reseña…) y las listas que sigues. Hay que crear una cuenta sí o sí (con correo y contraseña o con Google) y elegir tu usuario la primera vez; con la misma cuenta ves tu progreso en cualquier dispositivo.

1. **SQL Editor** → ejecuta `supabase/schema.sql` (tablas, normas RLS, borrar cuenta y tiempo real) y después `supabase/seed.sql` (las 8 bibliotecas oficiales). Los dos se pueden volver a ejecutar sin perder datos.
2. **Authentication → Sign In / Providers → Email**: desactiva «Confirm email» si quieres entrar nada más registrarte. Si lo dejas activado, el usuario confirma desde el correo y luego entra.
3. **Authentication → Emails → Reset Password**: añade `{{ .Token }}` a la plantilla para que la app pueda cambiar la contraseña con un código.
4. **Google**: en Google Cloud crea un *ID de cliente de OAuth* de tipo *Aplicación web* con la URI de redirección `https://<tu-proyecto>.supabase.co/auth/v1/callback`; en Supabase, **Authentication → Sign In / Providers → Google**, actívalo y pega el Client ID y el Client Secret; en **Authentication → URL Configuration → Redirect URLs** añade `sagaquest://auth-callback`.
5. **Project Settings → API**: copia la *Project URL* y la clave *anon public* y guárdalas en GitHub (Settings → Secrets and variables → Actions) como `SUPABASE_URL` y `SUPABASE_ANON_KEY`. El siguiente APK ya va conectado.

La clave *anon* es pública por diseño: lo que protege los datos son las normas Row Level Security (las listas privadas solo las lee su dueño y nadie puede cambiar lo de otro).

**Cómo se guarda**: la app escribe primero en el móvil y lo sube a Supabase enseguida. Cada subida se comprueba; si falla (sin red, error), el cambio queda pendiente y se reintenta al volver la conexión. Al abrir la app, al volver internet o si cambias algo en otro móvil (tiempo real), se descarga lo último sin pisar lo que tengas pendiente.

**Sin conexión**: la app lo detecta sola y pasa al modo perfil (solo tu biblioteca y tus listas; Descubrir, buscar y las listas de otros se desactivan). Para tener tu perfil en el móvil sin internet, descárgalo desde **Perfil → Usar sin conexión** (opcional; también se puede borrar la descarga para liberar espacio). Lo que cambies sin conexión se sube al volver.

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
src/data         qué series son oficiales y metadatos (sin juegos)
src/utils        lógica pura con sus tests
supabase         esquema SQL con RLS y datos iniciales
```
