# Synq

A clone of Zapier that allows users to create automated workflows (Zaps) between different applications using triggers and actions.

## Project Structure

- `frontend/`: Next.js frontend application
  - `app/`: Next.js app router pages and components
  - `components/`: Reusable React components
  - `hooks/`: Custom React hooks
  - `types/`: TypeScript type definitions

- `primary-backend/`: Main backend API service
  - `src/`: Source code
    - `router/`: API route handlers
    - `middleware/`: Authentication and other middleware
    - `db/`: Database configuration and models
  - `prisma/`: Database schema and migrations

- `hooks/`: Webhook handling service

- `processor/`: Background job processor

- `worker/`: Asynchronous task worker

## Setup

### Prerequisites

- Node.js (v18+)
- npm or yarn
- Docker + Docker Compose (recommended)

### 1) Start Infra (Postgres + Kafka)

From the repo root:

```bash
docker compose up -d
```

This starts:
- Postgres on `localhost:5432` (db: `zapier`, user: `postgres`, password: `postgres`)
- Apache Kafka broker on `localhost:9092`

### 2) Install Dependencies

```bash
cd primary-backend && npm install
cd ../hooks && npm install
cd ../processor && npm install
cd ../worker && npm install
cd ../frontend && npm install
```

### 3) Environment Setup

1. **Primary Backend API (`primary-backend/.env`)**
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/zapier?schema=public"
JWT_SECRET=your_jwt_secret
```

2. **Processor (`processor/.env`)**
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/zapier?schema=public"
```

3. **Hooks service**
- It does not read `.env` currently, so pass `DATABASE_URL` when starting it.

4. **Frontend (`frontend/.env.local`)**
```env
NEXT_PUBLIC_API_URL=http://localhost:8080
```

### 4) Database Migrations

Run migrations from the primary-backend directory:
```bash
cd primary-backend
npx prisma migrate dev
```

### 5) Seed Trigger/Action Types (one-time)

Without this, the Zap builder modal will be empty.

```sql
INSERT INTO "AvailableTrigger" ("id","name","image")
VALUES ('webhook_catch','Webhook Catch','https://placehold.co/64x64')
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "AvailableAction" ("id","name","image")
VALUES
('send_email','Send Email','https://placehold.co/64x64'),
('send_slack','Send Slack Message','https://placehold.co/64x64')
ON CONFLICT ("id") DO NOTHING;
```

### 6) Start Services (separate terminals)

1. **Primary Backend API**
```bash
cd primary-backend
npm run start
```

2. **Webhook Service**
```bash
cd hooks
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/zapier?schema=public" npm run start
```

3. **Background Processor**
```bash
cd processor
npm run start
```

4. **Task Worker**
```bash
cd worker
npm run start
```

5. **Frontend**
```bash
cd frontend
npm run dev
```

## Features

- User authentication
- Create Zaps with triggers and actions
- View and manage existing Zaps
- Real-time workflow execution

## Technologies Used

- Frontend: Next.js, React, TypeScript, Tailwind CSS
- Backend: Node.js, Express, TypeScript
- Database: PostgreSQL with Prisma ORM
- Authentication: JWT

## License

MIT
