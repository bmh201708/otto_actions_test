# Otto Web

Desktop-first control system for the Otto robot.

## Structure

- `frontend/`: Next.js + Tailwind admin interface
- `backend/`: Express + Prisma API
- `UI/`: reference images and source HTML used to recreate the pages
- `docker-compose.yml`: local Postgres + backend development stack

## Development

### 1. Backend

```bash
cp backend/.env.example backend/.env
docker compose up --build
```

The API will run on `http://localhost:4000`.

### 2. Frontend

```bash
cp frontend/.env.example frontend/.env.local
cd frontend
npm install
npm run dev
```

The UI will run on `http://localhost:3000`.

## Default Admin

Configured through backend environment variables:

- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `ADMIN_NAME`

The seed script creates or updates the single admin account on startup.

## LLM

The backend expects an OpenAI-compatible provider:

- `LLM_BASE_URL`
- `LLM_API_KEY`
- `LLM_MODEL`

If these are unset, the chat and oracle streaming endpoints return a configuration error while the rest of the system remains usable.

## Production Backend

For a server deployment, use the production compose file:

```bash
cp backend/.env.production.example backend/.env.production
docker compose -f docker-compose.prod.yml up -d --build
```

The production stack exposes only the API on `:4000`; Postgres stays internal to Docker.

For a server that cannot pull public base images reliably, build and save the API image locally, then use `docker-compose.server.yml` with a preloaded image on the server.
