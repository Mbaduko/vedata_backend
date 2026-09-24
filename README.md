# Vedata Backend

REST API for the Vedata veterinary data management system.

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **ORM:** Prisma
- **Database:** PostgreSQL
- **Auth:** JWT (access + refresh tokens)
- **Validation:** express-validator
- **Security:** Helmet, CORS, rate limiting

## Project Structure

```
src/
├── config/          # Environment configuration
├── controllers/     # Request handlers
├── middleware/       # Auth, error handling, validation
├── routes/          # API route definitions
├── services/        # Business logic (optional layer)
├── validations/     # Request validation schemas
└── utils/           # Helpers, Prisma client, error classes
prisma/
└── schema.prisma    # Database schema
```

## Setup

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your database credentials

# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# (Optional) Seed the database
npm run db:seed

# Start development server
npm run dev
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with hot-reload |
| `npm start` | Start production server |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push schema to database |
| `npm run db:migrate` | Run migrations (dev) |
| `npm run db:migrate:prod` | Run migrations (production) |
| `npm run db:seed` | Seed database |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:reset` | Reset database |
| `npm run lint` | Run ESLint |
| `npm run format` | Format with Prettier |

## API Endpoints

### Auth
- `POST /api/v1/auth/register` — Register new user
- `POST /api/v1/auth/login` — Login
- `POST /api/v1/auth/refresh` — Refresh tokens
- `POST /api/v1/auth/logout` — Logout
- `GET /api/v1/auth/me` — Get current user

### Zones
- `GET /api/v1/zones` — List zones
- `GET /api/v1/zones/tree` — Zone tree
- `GET /api/v1/zones/:id` — Zone detail
- `POST /api/v1/zones` — Create zone (superadmin)
- `PATCH /api/v1/zones/:id` — Update zone
- `POST /api/v1/zones/:id/move` — Move zone
- `POST /api/v1/zones/:id/archive` — Archive zone

### Animals
- `GET /api/v1/animals` — List/search animals
- `GET /api/v1/animals/:id` — Animal detail
- `POST /api/v1/animals` — Register animal
- `PATCH /api/v1/animals/:id` — Edit animal
- `POST /api/v1/animals/:id/deceased` — Mark deceased
- `DELETE /api/v1/animals/:id` — Delete animal

### Owners
- `GET /api/v1/owners` — List/search owners
- `GET /api/v1/owners/:id` — Owner detail
- `POST /api/v1/owners` — Create owner
- `PATCH /api/v1/owners/:id` — Edit owner

### Vaccinations
- `GET /api/v1/vaccinations` — List vaccinations
- `GET /api/v1/vaccinations/due` — Due/overdue list
- `GET /api/v1/vaccinations/:id` — Vaccination detail
- `POST /api/v1/vaccinations` — Record vaccination
- `PATCH /api/v1/vaccinations/:id` — Edit vaccination

### Disease/Vaccine Config
- `GET /api/v1/diseases` — List diseases
- `POST /api/v1/diseases` — Create disease
- `PATCH /api/v1/diseases/:id` — Update disease
- `GET /api/v1/diseases/:diseaseId/vaccines` — List vaccines
- `POST /api/v1/diseases/:diseaseId/vaccines` — Create vaccine
- `GET /api/v1/diseases/vaccines/:vaccineId/schedules` — List schedules
- `POST /api/v1/diseases/vaccines/:vaccineId/schedules` — Create schedule
- `DELETE /api/v1/diseases/schedules/:scheduleId` — Delete schedule

### Team
- `GET /api/v1/team` — List technicians
- `GET /api/v1/team/:id` — Technician detail + metrics
- `POST /api/v1/team/invite` — Invite technician
- `PATCH /api/v1/team/:id/contract` — Extend contract

### Users (superadmin)
- `GET /api/v1/users` — User directory
- `GET /api/v1/users/:id` — User detail
- `POST /api/v1/users` — Create user
- `PATCH /api/v1/users/:id` — Update user
- `POST /api/v1/users/:id/assign-zone` — Assign to zone

### Audit Log (superadmin)
- `GET /api/v1/audit` — List audit entries
- `GET /api/v1/audit/:id` — Entry detail
