# Restaurant UI (Frontend)

UI minima en React + Vite para:

- consultar menu
- crear orden
- visualizar estado/timeline de la orden

## Local setup

Desde `frontend/`:

```bash
cp .env.example .env
npm install
npm run dev
```

PowerShell:

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

## Environment variables

- `VITE_API_BASE_URL` (opcional)
  - default recomendado: `http://localhost:3000`

## Scripts

- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run lint`
