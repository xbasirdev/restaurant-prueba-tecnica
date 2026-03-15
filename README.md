# Restaurant Ordering API + Timeline Viewer

Repositorio dividido en dos apps:

- `backend/`: API NestJS (menu, orders, timeline).
- `frontend/`: UI React + Vite para consumir la API.

Este README permite levantar todo localmente desde una maquina limpia en menos de 10 minutos.

## Prerequisites

- Node.js 20.x (LTS recomendado)
- npm 10+
- Docker Desktop (para dependencias locales: MongoDB y Redis)



## Environment setup

### Backend env

Desde la raiz del repo:

```bash
cp backend/.env.example backend/.env
```

PowerShell:

```powershell
Copy-Item backend/.env.example backend/.env
```

Variables principales (`backend/.env`):

- Requeridas:
  - `PORT` (default 3000)
  - `ENABLE_DATABASE` (`true` para usar Mongo)
  - `ENABLE_REDIS` (`true` para usar Redis en idempotencia)
  - `MONGODB_URI`
  - `MONGODB_DB_NAME`
- Opcionales:
  - `REDIS_URL`
  - `NODE_ENV`
  - `MONGO_PORT`
  - `MONGO_ROOT_USERNAME`
  - `MONGO_ROOT_PASSWORD`
  - `MONGO_INITDB_DATABASE`

### Frontend env

Desde la raiz del repo:

```bash
cp frontend/.env.example frontend/.env
```

PowerShell:

```powershell
Copy-Item frontend/.env.example frontend/.env
```

Variables (`frontend/.env`):

- Opcional:
  - `VITE_API_BASE_URL` (default sugerido: `http://localhost:3000`)

## How to run locally

### Opcion recomendada: ejecucion manual (backend + frontend)

Orden recomendado de arranque:

1. Dependencias locales (MongoDB + Redis con Docker)
2. Backend API (Nest dev)
3. Seed de menu
4. Frontend UI

#### 1) Levantar dependencias locales

Desde la raiz del repo:

```bash
docker compose up -d
```

#### 2) Levantar backend manualmente

En una terminal:

```bash
cd backend
npm install
npm run start:dev
```

#### 3) Cargar seed de menu

En otra terminal:

```bash
cd backend
npm run db:migrate:menu
```

#### 4) Levantar frontend manualmente

En otra terminal:

```bash
cd frontend
npm install
npm run dev
```

### Opcion alternativa: backend con Serverless Offline

Si quieres simular la API en modo serverless local, en vez de `npm run start:dev` puedes usar:

```bash
cd backend
npm run serverless:offline
```

Notas:

- Esta opcion es alternativa al modo Nest dev (no necesitas correr ambos al mismo tiempo).
- El frontend se levanta igual con `npm run dev` en `frontend/`.

## Ports

- MongoDB: `27017`
- Redis: `6379`
- Backend API: `3000`
- Frontend Vite: `5173`

## API quick check

- Menu: `GET http://localhost:3000/menu`
- Crear orden: `POST http://localhost:3000/orders` (con header `Idempotency-Key`)
- Ver orden: `GET http://localhost:3000/orders/:orderId`
- Timeline: `GET http://localhost:3000/orders/:orderId/timeline?page=1&pageSize=20`

## How to test

Desde `backend/`:

```bash
npm run test
npm run test:e2e
```

## Seed / sample data

El seed del menu carga 7 productos (incluyendo productos personalizables con grupos de modificadores).

Comando:

```bash
cd backend
npm run db:migrate:menu
```

Nota: el backend incluye `serverless.yml` y soporte de `serverless offline`.