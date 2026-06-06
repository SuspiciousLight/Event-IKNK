# VK Mini App Diplom Project

Production-like baseline for student event registrations with security-first architecture.

## Stack

- Frontend: React + TypeScript + VKUI
- Backend: NestJS + TypeScript
- Database: PostgreSQL
- ORM: Prisma
- Admin Auth: JWT in HttpOnly cookie
- Export: ExcelJS (planned for next stage)

## Run

1. `corepack pnpm install`
2. `docker compose -f infra/docker-compose.yml up -d`
3. `Copy .env.example to .env and adjust values`
4. `corepack pnpm exec prisma generate --schema prisma/schema.prisma`
5. `corepack pnpm --filter backend exec prisma migrate dev --schema ../../prisma/schema.prisma`
6. `corepack pnpm --filter backend exec prisma db seed --schema ../../prisma/schema.prisma`
7. `corepack pnpm dev`

## Security baseline

- RBAC (`user`/`admin`) enforced on backend
- Rate limiting for sensitive endpoints
- Input validation with whitelist/forbidNonWhitelisted
- Explicit consent acceptance with version and hash
- Soft delete and cancellation logs for registrations
- No admin tokens in localStorage/sessionStorage
- Sanitized logs without raw personal data
