# Controlled write-flow load test

This runner tests mutating user scenarios that cannot be safely expressed as static
Yandex Tank Phantom ammo:

- `PATCH /api/v1/users/me/profile`
- `POST /api/v1/registrations`
- `POST /api/v1/reminders/registrations/:registrationId`
- `PATCH /api/v1/registrations/:registrationId/cancel`

It signs `X-VK-Launch-Params` with `VK_APP_SECRET`, so backend VK auth is exercised.

## Safety rules

Run this only on a dedicated test event, for example `Нагрузочный тест`.

The script creates synthetic:

- users;
- profiles;
- registrations;
- consent records;
- reminders;
- cancellation audit records.

It cancels created registrations, but audit/history rows remain in the database.

Do not run it against a real public event with real participants.

## Recommended test event

Create an event in the admin panel:

- title: `Нагрузочный тест`;
- status: published;
- start time: at least several hours in the future;
- participant limit: empty/unlimited or more than expected registrations;
- form: optional; if a form exists, the runner will generate valid test answers.

## Run on server

```bash
cd /var/www/Event-IKNK
git pull
node load-testing/write-flow/write-flow.mjs \
  --target https://event-iknk.ru \
  --find-event-title "Нагрузочный тест" \
  --duration 15m \
  --drain 2m \
  --users 2000 \
  --max-registrations 1800 \
  --confirm-write-test
```

For a shorter smoke test:

```bash
node load-testing/write-flow/write-flow.mjs \
  --target https://event-iknk.ru \
  --find-event-title "Нагрузочный тест" \
  --duration 2m \
  --drain 1m \
  --users 150 \
  --max-registrations 120 \
  --confirm-write-test
```

## Load profile

During the registration phase:

- registrations: `1-3 RPS`;
- reminders: `0.5-1 RPS`;
- cancellations: `0.5-1 RPS`.

After the registration phase ends, the runner drains pending reminder/cancel queues.
Then it runs a separate cleanup phase and cancels remaining active synthetic registrations
at `5 RPS` by default. Cleanup is needed because the measured cancel rate is intentionally
lower than the registration rate.

To change cleanup speed:

```bash
node load-testing/write-flow/write-flow.mjs \
  --target https://event-iknk.ru \
  --find-event-title "Нагрузочный тест" \
  --duration 15m \
  --cleanup-rps 10 \
  --confirm-write-test
```

To skip cleanup, use `--skip-cleanup`, but do this only if you plan to clean test data manually.

## Diploma wording

Use this test together with the 15-minute Yandex Tank read-flow.

Recommended wording:

> Read-flow was tested with Yandex Tank up to 35 RPS, which corresponds to about
> 200-300 active users when one user performs an action every 8-10 seconds.
> Mutating operations were tested separately with a controlled write-flow:
> registrations at 1-3 RPS, reminders and cancellations at 0.5-1 RPS on a
> dedicated test event.
