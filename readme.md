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
- PostgreSQL database

### Backend Services Setup

1. **Primary Backend API**
   ```bash
   cd primary-backend
   npm install
   npm run start
   ```

2. **Webhook Service**
   ```bash
   cd ../hooks
   npm install
   npm run start
   ```

3. **Background Processor**
   ```bash
   cd ../processor
   npm install
   npm run start
   ```

4. **Task Worker**
   ```bash
   cd ../worker
   npm install
   npm run start
   ```

### Frontend Setup

1. **Development Server**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

### Environment Setup

1. **Backend Services**
   Create a `.env` file in each service directory with appropriate configurations.
   
   Example for `primary-backend/.env`:
   ```
   DATABASE_URL="postgresql://user:password@localhost:5432/zapier?schema=public"
   JWT_SECRET=your_jwt_secret
   ```

2. **Frontend**
   Create a `.env.local` file in the frontend directory:
   ```
   NEXT_PUBLIC_API_URL=http://localhost:8080
   ```

### Database Migrations

Run migrations from the primary-backend directory:
```bash
cd primary-backend
npx prisma migrate dev
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
