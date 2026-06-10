# Yandex Tank load testing

This folder contains reproducible load profiles for the NestJS backend.

## Target

Default Docker configs target `host.docker.internal:3000`, which is the host machine from inside Docker Desktop. If Yandex Tank is installed directly on the host, use `load-local.yaml` instead.

The ammo uses only idempotent read scenarios:

- `GET /api/v1/health`
- `GET /api/v1/users/profile-disclaimer`
- `GET /api/v1/events?page=1&pageSize=10`
- `GET /api/v1/events/22222222-2222-4222-8222-222222222222`
- `GET /api/v1/events/44444444-4444-4444-8444-444444444444`
- `GET /api/v1/registrations/me?page=1&pageSize=10`

The `x-vk-user-id: 100001` header lets protected user endpoints pass the development VK guard without production signatures.

## Preparation

Run Postgres, migrations, seed data, and backend:

```powershell
docker compose -f infra/docker-compose.yml up -d
corepack pnpm --filter backend prisma:migrate
corepack pnpm --filter backend prisma:seed
corepack pnpm --filter backend dev
```

In another terminal, verify the backend:

```powershell
curl http://localhost:3000/api/v1/health
```

## Run

Smoke test, 2 RPS for 30 seconds:

```powershell
corepack pnpm run loadtest:tank:smoke
```

Main profile, gradual 1 to 50 RPS for 10 minutes:

```powershell
corepack pnpm run loadtest:tank
```

Production-safe 10 minute test for `https://event-iknk.ru`:

```powershell
corepack pnpm run loadtest:tank:prod
```

Production 15 minute realistic wave test for `https://event-iknk.ru`.
This profile is suitable for diploma demonstration as an equivalent of about
200-300 active users when one user performs an action every 8-10 seconds:

```powershell
corepack pnpm run loadtest:tank:prod:15m
```

On the Linux server run it through Docker:

```bash
cd /var/www/Event-IKNK/load-testing/yandex-tank
docker run --rm --net host -v "$(pwd)":/var/loadtest -w /var/loadtest -it yandex/yandex-tank -c load-prod-15min-200-300-users.yaml
```

The production profile uses only:

- `GET /`
- `GET /api/v1/health`
- `GET /privacy-policy.html`
- `GET /user-agreement.html`

It does not call VK-protected user endpoints, so 400/401 responses should not dominate the report.

Important: Yandex Tank primarily controls RPS or instances. For a production VPS, use the RPS profile above.
Do not run a raw `instances=300` profile against the public server unless you intentionally want a stress test:
with very fast responses, 300 instances can generate much more traffic than 300 real users.

On the Linux server you can run the same config directly:

```bash
cd /var/www/Event-IKNK/load-testing/yandex-tank
docker run --rm --net host -v "$(pwd)":/var/loadtest -w /var/loadtest -it yandex/yandex-tank -c load-prod-10min.yaml
```

Native Yandex Tank example:

```powershell
cd load-testing/yandex-tank
yandex-tank -c load-local.yaml
```

## Pass criteria

Treat the run as successful when:

- 5xx responses stay below 5%.
- Network errors stay at 0.
- Average response time stays below 1500 ms.
- The backend process and Postgres remain stable for the whole profile.
