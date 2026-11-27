# AJP Fighter OS

Plataforma para planificar, registrar y analizar la preparación física y técnica de un competidor de Brazilian Jiu-Jitsu de cara al **AJP 2027**.

**Stack:** React + TypeScript + Vite + Tailwind (frontend) · Java 17 + Spring Boot 3.5 + Spring Security (JWT) + Spring Data MongoDB (backend) · MongoDB 7.

---

## Uso diario

Doble clic en **`arrancar.bat`**: abre Docker si hace falta, arranca MongoDB, compila la app y arranca el servidor.
La app completa queda en **http://localhost:8080** y la ventana muestra también las direcciones para el móvil.
No cierres esa ventana mientras uses la app.

### Desde el móvil (en cualquier sitio)

La app está publicada en **GitHub Pages**, con HTTPS y sin depender del ordenador:
**https://jbbadia.github.io/ajp-fighter-os/**

- Funciona en **modo local**: los datos se guardan en el navegador de cada dispositivo (no hay login ni servidor).
- **Sincronizar PC y móvil** (Perfil): cada dispositivo fusiona sus datos con un archivo JSON en un repositorio
  **privado** de GitHub (`usuario/ajp-fighter-os-datos`) usando un token de grano fino con permiso
  *Contents: Read and write* solo sobre ese repositorio. Gana la edición más reciente de cada registro y los borrados
  se propagan. El token se guarda solo en el navegador. Se sincroniza tras cada cambio, al volver a la app y cada minuto
  (`frontend/src/data/sync.ts`, fusión en `syncMerge.ts`).
- Sin sincronización, también se pueden pasar datos con Perfil → **Copia de seguridad** / **Restaurar copia**.
- Cada cambio que se sube a la rama `main` se publica solo: GitHub Actions pasa los tests, compila y publica
  (`.github/workflows/pages.yml`). Si un test falla, no se publica nada.

### Versión con servidor (en el PC)

- **En el wifi de casa:** abre en el móvil la dirección `http://192.168.x.x:8080` que muestra la ventana.
- **Fuera de casa:** instala [Tailscale](https://tailscale.com) (gratis) en el ordenador y en el móvil con la misma cuenta.
  Es una red privada cifrada: solo tus dispositivos ven la app, no está publicada en internet.
  Abre `http://<nombre-del-pc>:8080` (la ventana lo muestra al arrancar). El ordenador tiene que estar encendido.
- **Instalarla como app:** en el navegador del móvil, «Añadir a pantalla de inicio» (Safari: botón Compartir; Chrome: menú ⋮).

## Arrancar en modo desarrollo

Requisitos: Node 20+, Java 17+, Maven 3.9+, Docker (para MongoDB).

```bash
# 1) Base de datos
docker compose up -d                 # MongoDB en localhost:27017

# 2) API (http://localhost:8080)
cd backend
# PowerShell: $env:JWT_SECRET = "<base64 de 48 bytes>"   ·   bash: export JWT_SECRET=$(openssl rand -base64 48)
mvn spring-boot:run

# 3) Frontend (http://localhost:5173) — en otra terminal
cd frontend
npm install
npm run dev
```

Abre http://localhost:5173, crea tu cuenta y la app generará tu perfil y la planificación inicial.

**Modo local sin servidor** (demo/offline): crea `frontend/.env.local` con `VITE_DATA_MODE=local`. Los datos se guardan en el navegador y no hay login.

### Variables de entorno (backend)

| Variable | Por defecto | Descripción |
|---|---|---|
| `SPRING_DATA_MONGODB_URI` | `localhost:27017` | Cadena de conexión (p. ej. MongoDB Atlas) |
| `MONGODB_DATABASE` | `ajp_fighter_os` | Base de datos |
| `JWT_SECRET` | *(aleatorio)* | Base64 ≥ 256 bits. **Obligatorio en producción**; sin él las sesiones caducan al reiniciar |
| `JWT_EXPIRATION` | `7d` | Duración de la sesión |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173` | Orígenes permitidos (separados por comas) |
| `SERVER_PORT` | `8080` | Puerto |

Frontend: `VITE_API_URL` (por defecto `/api`, con proxy de Vite al puerto 8080) y `VITE_DATA_MODE` (`api` | `local`).

## Pruebas

```bash
cd frontend && npm test        # 44 tests: lógica de dominio (semáforo, alertas, métricas, récords, progresión de gimnasio, adaptación, CSV) y fusión de la sincronización
```

---

## Módulos

| Módulo | Qué incluye |
|---|---|
| **Dashboard** | Cuenta atrás, progreso del ciclo, peso, sesiones, horas BJJ/gym, cardio, semáforo de recuperación, alertas del hombro, próximo entrenamiento con cronómetro, indicadores y evolución de fuerza |
| **Calendario** | Vista semanal y mensual, crear/editar/eliminar/duplicar, arrastrar y soltar, sesiones no planificadas, rellenar semana con la plantilla, **ajustes sugeridos** (fatiga, hombro, sesiones perdidas) |
| **BJJ** | Registro Gi/No-Gi (rounds, compañeros, RPE, calidad técnica, fatiga), sparring round a round, estadísticas y **biblioteca técnica** (categorías, estados, técnica principal, notas, vídeos) |
| **Gimnasio** | Rutinas personalizadas, catálogo de ejercicios, series/reps/peso/RIR/descanso, **modo entrenamiento** desde el calendario (ejercicios en orden con series, repeticiones, peso propuesto, RIR y descanso; marcar series con ✓, cuenta atrás de descanso con vibración, se conserva si cierras la app), **siguiente sesión calculada** (progresión doble: sube 2,5 kg si completas todo con el RIR previsto, repite si llegas justo o faltan 1–2 reps, baja ~10 % si te quedas lejos; nunca sube con la recuperación en rojo), evolución de cargas, volumen semanal, récords personales. Tren superior bloqueado sin autorización médica |
| **Cardio** | Zona 2, HIIT y cardio específico BJJ; FC, velocidad en Z2, RPE, tiempo en zonas (solo si el dispositivo lo da) y volumen semanal. Sin estimaciones de VO2máx |
| **Recuperación** | Check-in diario, semáforo verde/amarillo/rojo con sus motivos, tendencias 30/60/90 días, historial editable, alertas por dolor creciente o pérdida de movilidad |
| **Rehab hombro** | Protocolo Derby de inestabilidad pautado por el fisio: un ejercicio de cada sección, en orden; al conseguir el objetivo (100/50/20 reps o 5 × 60 s) pasa al siguiente. Contador de repeticiones, cronómetro que para a los 60 s, 2 sesiones al día a cualquier hora, aviso en el Dashboard y marca diaria en el calendario |
| **Nutrición** | Calorías, macros y agua con objetivos configurables, peso diario + media de 7 días, medias semanales, suplementos con dosis/horarios y registro de tomas (sin recomendaciones) |
| **Competition Mode** | Cuenta atrás, reglamento configurable (duración, límite de peso), estado de la preparación, 4 fases editables, checklist, objetivos semanales con progreso automático y **simulador de combate** con temporizador |
| **Analítica** | Peso 30/60/90 d, sesiones/semana, BJJ, Gi vs No-Gi, gym, cardio, cargas, RPE, recuperación, cumplimiento de objetivos, consistencia semanal + racha, comparar semanas |
| **Historial** | Todas las sesiones con búsqueda y filtros, exportación CSV |
| **Perfil** | Datos del deportista, competición, autorización del hombro (adapta las sesiones futuras), unidades kg/lb, tema, notificaciones, copia de seguridad y restauración |

## Arquitectura

```
frontend/src/
  types/domain.ts      Modelo de dominio (contrato con la API)
  data/                adapters.ts (REST | localStorage), store.ts (colecciones observables, escrituras
                       optimistas y serializadas), auth.ts, http.ts, backup.ts, seed.ts
  domain/              Lógica pura y testeada: recovery, metrics, analytics, adaptation,
                       planTemplate, gymStats, cardioStats, bjjStats, nutritionStats, notifications
  components/          ui/ (estilo shadcn), layout/, charts/ (Recharts)
  features/            Una carpeta por pantalla

backend/src/main/java/com/ajp/fighteros/
  auth/                Registro, login, JWT, BCrypt, bloqueo tras 5 intentos fallidos
  data/                API /api/collections/{coleccion}/{id} por usuario, backup, validadores por colección
  common/              ApiError + manejo global de excepciones
  config/              Seguridad (stateless, CORS), propiedades desde variables de entorno
```

**API REST** (todas requieren `Authorization: Bearer <token>` salvo registro/login):

```
POST   /api/auth/register      POST /api/auth/login      GET /api/auth/me
GET    /api/collections/{c}    PUT  /api/collections/{c}/{id}    DELETE /api/collections/{c}/{id}
GET    /api/backup             PUT  /api/backup
```


Colecciones: `profile, sessions, dailyLogs, exercises, routines, techniques, nutrition, supplements, supplementIntakes, goals, simulations, rehabLogs`. Cada entidad se guarda como documento del usuario en MongoDB (`entities`, índice único `userId+collection+entityId`) y se valida en servidor con las mismas reglas que los formularios.

## Principios

- **Sin datos inventados.** Todas las métricas salen de tus registros; si no hay datos se muestra un estado vacío. La plantilla inicial solo crea sesiones *planificadas*.
- **El hombro nunca se asume autorizado.** Cargas de tren superior y sparring intenso dependen de la autorización registrada en el perfil.
- **No es una herramienta médica.** Sugiere reducir la carga, pero no diagnostica ni sustituye a un profesional sanitario. No recomienda suplementos ni dosis.
- **Reglamento configurable.** Duración de combate, límite de peso y categoría se introducen según el reglamento AJP oficial.