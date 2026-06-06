# Security Best Practices Report

## Executive Summary

Проект использует безопасный baseline для VK Mini App: NestJS API, Prisma ORM, PostgreSQL, JWT администратора в `HttpOnly` cookie, RBAC на backend и минимизацию персональных данных. В рамках этапа 11 добавлены недостающие controls: rate limiting для чувствительных endpoint, CSRF/origin-защита для cookie-auth state-changing запросов, расширенный audit logging, усиленная DTO-валидация и production-check для `JWT_SECRET`.

## High Severity

### H-1: CSRF для cookie-auth state-changing запросов

- Location: `apps/backend/src/common/guards/csrf-origin.guard.ts`
- Impact: без CSRF-защиты внешний сайт мог попытаться выполнить POST/PATCH от имени администратора или пользователя при наличии auth-cookie.
- Fix: добавлен глобальный `CsrfOriginGuard`, который для небезопасных методов и cookie-auth требует trusted origin/fetch-site и header `X-Requested-With: VKMiniApp`.
- Frontend: `apps/frontend/src/api/client.ts` добавляет `X-Requested-With`.

### H-2: Brute force на admin login

- Location: `apps/backend/src/modules/auth/auth.controller.ts`
- Impact: без ограничения попыток endpoint входа администратора можно было перебрать.
- Fix: добавлен `@RateLimit({ limit: 5, windowMs: 15 * 60 * 1000 })` на `POST /auth/admin/login`.

## Medium Severity

### M-1: Недостаточное покрытие audit logging

- Location: `apps/backend/src/modules/auth/auth.service.ts`, `apps/backend/src/modules/users/users.service.ts`, `apps/backend/src/modules/consents/consents.service.ts`, `apps/backend/src/modules/reminders/reminders.service.ts`
- Impact: без аудита сложнее расследовать входы администратора, изменение профиля, принятие согласия и управление напоминаниями.
- Fix: добавлены события `ADMIN_LOGIN`, `ADMIN_LOGOUT`, `ADMIN_LOGIN_FAILED`, `PROFILE_UPDATED`, `CONSENT_ACCEPTED`, `REMINDER_CREATED`, `REMINDER_UPDATED`, `REMINDER_CANCELED`.

### M-2: Слабый production default для JWT secret

- Location: `apps/backend/src/modules/auth/auth.module.ts`, `apps/backend/src/modules/auth/jwt.strategy.ts`
- Impact: production без `JWT_SECRET` мог стартовать с небезопасным значением по умолчанию.
- Fix: production теперь падает при отсутствии `JWT_SECRET`; dev использует только явный dev fallback.

### M-3: Mass assignment / избыточные поля

- Location: `apps/backend/src/main.ts`
- Fix: глобальный `ValidationPipe` работает с `whitelist: true` и `forbidNonWhitelisted: true`; DTO дополнительно ужесточены для вопросников, согласий, профиля и рассылок.

## Low Severity / Defense In Depth

### L-1: In-memory rate limit

- Location: `apps/backend/src/common/rate-limit/rate-limit.service.ts`
- Note: подходит для дипломного baseline и одного процесса, но для production с несколькими instance нужен Redis-backed limiter или gateway-level throttling.

### L-2: CSP для frontend

- Location: frontend static hosting / edge config
- Note: в repo не виден production edge/CDN config. Для production нужно добавить CSP, `frame-ancestors`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` на уровне хостинга.

## Controls Verified

- IDOR/BOLA: пользовательские операции по регистрациям, согласиям и напоминаниям фильтруются по `userId` из backend auth context.
- Admin RBAC: admin controllers защищены `JwtAuthGuard`, `RolesGuard`, `@Roles(Role.ADMIN)`.
- Injection: Prisma ORM используется без raw SQL; dangerous shell/file sinks не обнаружены.
- Excessive export: Excel export выбирает только `fullName`, `phone`, `email`, `registeredAt`, `status`.
- Insecure logging: request logs не содержат body; audit metadata редактируется по чувствительным ключам.
- Token storage: frontend не хранит admin token в `localStorage/sessionStorage`; используется cookie flow.

## Remaining Recommendations

1. Перенести rate limiting в Redis/gateway при горизонтальном масштабировании.
2. Добавить production CSP/security headers для frontend hosting.
3. Добавить e2e-тесты на IDOR, RBAC, CSRF, VK launch params auth и rate limit.
4. Описать регламент удаления/деактивации профиля и retention персональных данных.
