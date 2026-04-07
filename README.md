# Repair Admin Panel

Production-ready repair management system for a caravan and trailer repair business, replacing spreadsheet-based workflows.

## Tech Stack

- **Framework**: Next.js 15+ (App Router, Turbopack)
- **Auth**: Auth.js v5 (Credentials provider, JWT sessions)
- **Database**: PostgreSQL via Neon + Drizzle ORM
- **Styling**: Tailwind CSS v4 + Radix UI primitives
- **Validation**: Zod
- **Language**: TypeScript (strict)

## Getting Started

### Prerequisites

- Node.js 20+
- Neon database (or any PostgreSQL)

### Setup

1. Clone the repository

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env.local` from the template:
   ```bash
   cp .env.example .env.local
   ```

4. Set your environment variables:
   ```env
   DATABASE_URL=postgresql://user:pass@host/dbname?sslmode=require
   AUTH_SECRET=your-random-secret-here
   ADMIN_EMAIL=admin@yourdomain.com
   ADMIN_PASSWORD=changethis
   ```

5. Push the schema to your database:
   ```bash
   npm run db:push
   ```

6. Seed initial data (admin user, locations, tags):
   ```bash
   npm run db:seed
   ```

7. Start the development server:
   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000) and log in with your admin credentials.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with Turbopack |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run db:push` | Push schema to database |
| `npm run db:generate` | Generate migration files |
| `npm run db:migrate` | Run migrations |
| `npm run db:studio` | Open Drizzle Studio |
| `npm run db:seed` | Seed admin user, locations, tags |

## User Roles

| Role | Permissions |
|------|-------------|
| **Admin** | Full access: manage users, import, export, all CRUD |
| **Manager** | Create/edit repairs, customers, units, tags, export |
| **Staff** | Create/edit repairs, customers, units |
| **Viewer** | Read-only access to all data |

## Features

- **Dashboard** — KPIs, recent activity, jobs by status/location
- **Repair Jobs** — Full CRUD with 13 statuses, filters, search, pagination
- **Kanban Board** — Drag-and-drop status management
- **Customers** — Customer management with linked repairs
- **Units/Vehicles** — Registration tracking with repair history
- **Spreadsheet Import** — Multi-sheet Excel import with auto-detection of status, customer response, normalization flags
- **Parts & Suppliers** — Part catalog, supplier directory, part requests per job
- **Audit Log** — Complete action history with filtering
- **CSV Export** — Filtered repair data export
- **Settings** — Location, user, and tag management
- **Role-Based Access** — Four-tier permission system

## Spreadsheet Import

The import system processes Excel files (.xlsx, .xls) and CSV:

- Each sheet tab becomes a **location**
- Column headers are auto-matched by keyword (customer, status, registration, etc.)
- Status is inferred from cell content (multilingual: EN/NL/ES)
- Normalization flags detect issues (tyres, lighting, water, safety, etc.)
- Original raw text is always preserved
- Every import is logged with full statistics

## Project Structure

```
src/
├── actions/          # Server actions (CRUD, import, audit)
├── app/
│   ├── (auth)/       # Login page
│   ├── (dashboard)/  # All authenticated pages
│   │   ├── repairs/  # List, detail, new, board
│   │   ├── customers/
│   │   ├── units/
│   │   ├── import/
│   │   ├── audit/
│   │   ├── parts/
│   │   └── settings/ # Locations, users, tags
│   └── api/          # Auth, import, export routes
├── components/
│   ├── layout/       # Sidebar, header
│   ├── repairs/      # Repair-specific components
│   └── ui/           # Base UI components
├── lib/
│   ├── db/           # Schema, seed, connection
│   ├── auth.ts       # NextAuth configuration
│   ├── auth-utils.ts # Role/permission helpers
│   ├── utils.ts      # Utility functions
│   └── validators.ts # Zod schemas
└── types/            # TypeScript type definitions
```

## Deployment (Vercel)

1. Push to GitHub
2. Import in Vercel
3. Set environment variables (DATABASE_URL, AUTH_SECRET)
4. Deploy — Vercel auto-detects Next.js

## Future Roadmap

- Photo attachments per repair job
- Email notifications (status changes, quotes)
- Customer portal (read-only job status)
- Recurring service scheduling
- Financial reporting dashboard
- Mobile-optimized technician view
