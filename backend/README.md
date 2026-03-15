# Restaurant API (Backend)

NestJS API con arquitectura limpia para menu, ordenes y timeline.

## Note

- El flujo de arranque completo del proyecto (frontend + backend + Docker) esta en el README de la raiz del repositorio.
- El `docker-compose.yml` fue centralizado en la raiz para ejecutar dependencias locales desde un unico lugar.

## Local backend setup

Desde `backend/`:

```bash
cp .env.example .env
npm install
```

Ejecutar en modo Nest:

```bash
npm run start:dev
```

Ejecutar en modo Serverless offline:

```bash
npm run serverless:offline
```

Configuracion serverless:

- `serverless.yml`
- handler Lambda: `src/lambda.ts`

Variables Redis (opcional):

- `ENABLE_REDIS=true`
- `REDIS_URL=redis://localhost:6379`

En otra terminal, para seed de menu:

```bash
npm run db:migrate:menu
```

## Endpoints

- `GET /menu`
- `POST /orders` (requiere header `Idempotency-Key`)
- `GET /orders/:orderId`
- `GET /orders/:orderId/timeline?page=1&pageSize=20`

## Tests

```bash
npm run test
npm run test:e2e
```
