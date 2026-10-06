# PRD — Futbase / Liga Alevín (app móvil)

## Problem statement
Crear una app móvil (Expo / React Native) que replica el repositorio
`djlom77-cmd/Futbase-7-11` con las mismas pantallas y el mismo diseño:
una app de gestión de un club de fútbol base (alevín) con roles Entrenador y
Padre/Madre.

## Architecture
- **Backend**: FastAPI + MongoDB (motor). Auth JWT propia (bcrypt), rutas con
  prefijo `/api`. Integraciones Emergent: Object Storage (imágenes), Gemini
  vision (`gemini-3.1-pro-preview`) para escaneo IA, Resend gestionado (email de
  recuperación). Archivo: `/app/backend/server.py`.
- **Frontend**: Expo Router. Tema dinámico controlado por el entrenador
  (`src/theme.tsx`: presets + modo oscuro + colores personalizados). Contextos:
  `auth`, `toast`, `AppThemeProvider`. Datos con React Query (`useClubData`,
  polling de 5s solo para PADRE). Pantallas en `src/screens/*`, carcasa con
  cabecera en gradiente + navegación inferior propia en `HomeShell`.

## User personas
- **Entrenador (ENTRENADOR)**: crea el club, gestiona equipos, partidos,
  jugadores, estadísticas, escudo, tema y colores; invita padres por código.
- **Padre/Madre (PADRE)**: acceso de solo lectura; ve partidos, clasificación,
  plantilla y rankings; vista en vivo (polling).

## Core requirements (static)
- Login/registro email+contraseña, roles, código de invitación, recuperación por email.
- Pantallas: Partidos (jornada/calendario + próximo partido + Google Maps),
  Clasificación automática, Plantilla (fichas + filtro + modal), Rankings
  (pichichi/asistencias), Panel del Entrenador (club, invitar, resultados con
  escaneo IA, editar/borrar partidos, equipos+campos con escaneo IA, jugadores,
  escudo, colores/tema/modo oscuro, demo, reset).

## Implemented (2026-06)
- Backend completo portado y verificado: **32/32 tests backend OK** (auth, roles,
  config, teams, matches, standings, players+stats, upload/files, scan IA, email).
- Frontend completo: Auth + HomeShell + 5 pantallas + Panel del Entrenador con
  todas las secciones; tema dinámico, toasts, subida de fotos con permisos.
- Verificado en preview: pantalla de login y shell autenticado con las 5 pestañas.

## Backlog / próximos (P1/P2)
- P1: selector de fecha nativo para jornadas (hoy campo YYYY-MM-DD).
- P1: compartir jornada/clasificación por WhatsApp.
- P2: MVP de la jornada destacado en la ficha; escudo IA por colores.
- P2: migrar polling de padres a websockets.
