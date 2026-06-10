#!/usr/bin/env node
import { createHmac } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

loadEnvFile(path.join(repoRoot, '.env'));

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printHelp();
  process.exit(0);
}

const targetOrigin = normalizeOrigin(args.target ?? process.env.LOADTEST_TARGET ?? 'https://event-iknk.ru');
const vkSecret = process.env.VK_APP_SECRET;
const vkAppId = String(args.appId ?? process.env.VK_APP_ID ?? '0');
const eventIdArg = args.eventId ?? process.env.LOADTEST_WRITE_EVENT_ID;
const findEventTitle = args.findEventTitle ?? process.env.LOADTEST_WRITE_EVENT_TITLE;
const durationMs = parseDuration(args.duration ?? process.env.LOADTEST_WRITE_DURATION ?? '15m');
const drainMs = parseDuration(args.drain ?? process.env.LOADTEST_WRITE_DRAIN ?? '2m');
const users = toPositiveInt(args.users ?? process.env.LOADTEST_WRITE_USERS, 2000);
const vkUserStart = toPositiveInt(args.vkUserStart ?? process.env.LOADTEST_WRITE_VK_USER_START, 991000000000);
const maxRegistrations = toPositiveInt(args.maxRegistrations ?? process.env.LOADTEST_WRITE_MAX_REGISTRATIONS, 1800);
const cleanupRps = toPositiveInt(args.cleanupRps ?? process.env.LOADTEST_WRITE_CLEANUP_RPS, 5);
const skipCleanup = args.skipCleanup === true || process.env.LOADTEST_WRITE_SKIP_CLEANUP === 'true';
const simulateClientIps = args.simulateClientIps === true || process.env.LOADTEST_WRITE_SIMULATE_CLIENT_IPS === 'true';
const reportEveryMs = parseDuration(args.reportEvery ?? '10s');
const confirmed = args.confirmWriteTest === true || process.env.LOADTEST_WRITE_CONFIRM === 'true';

if (!confirmed) {
  fail(
    [
      'Write-flow load test is blocked by default.',
      'It creates synthetic profiles, registrations, consents, reminders and cancellation logs.',
      'Run it only on a dedicated test event and pass --confirm-write-test.',
    ].join('\n'),
  );
}

if (!vkSecret) {
  fail('VK_APP_SECRET is required in .env or environment.');
}

if (!eventIdArg && !findEventTitle) {
  fail('Pass --event-id <uuid> or --find-event-title "Нагрузочный тест".');
}

const state = {
  startedAt: Date.now(),
  phase: 'registration',
  nextUserOffset: 0,
  registrationAccumulator: 0,
  reminderAccumulator: 0,
  cancelAccumulator: 0,
  reminderQueue: [],
  cancelQueue: [],
  running: {
    registrations: 0,
    reminders: 0,
    cancels: 0,
  },
  counters: {
    profileOk: 0,
    profileFail: 0,
    registrationOk: 0,
    registrationFail: 0,
    reminderOk: 0,
    reminderFail: 0,
    cancelOk: 0,
    cancelFail: 0,
    cleanupCancelOk: 0,
    cleanupCancelFail: 0,
  },
  createdRegistrations: new Map(),
  canceledRegistrations: new Set(),
  httpCodes: new Map(),
  errors: new Map(),
  timings: {
    profile: [],
    registration: [],
    reminder: [],
    cancel: [],
  },
};

const firstAuth = authHeadersFor(vkUserStart);
const eventId = eventIdArg ?? await findEventByTitle(findEventTitle, firstAuth);
const eventCard = await getEventCard(eventId, firstAuth);
const currentConsent = await requestJson('GET', '/api/v1/consents/current', {
  authHeaders: firstAuth,
  operation: 'consent',
});

validateEventForWriteTest(eventCard);

console.log('Controlled write-flow load test');
console.log(`Target: ${targetOrigin}`);
console.log(`Event: ${eventCard.event.title} (${eventId})`);
console.log(`Duration: ${formatDuration(durationMs)}, drain: ${formatDuration(drainMs)}`);
console.log(`Synthetic VK users: ${users}, max registrations: ${maxRegistrations}`);
console.log('Rates: registrations 1-3 RPS, reminders 0.5-1 RPS, cancels 0.5-1 RPS');
console.log(`Simulated client IPs: ${simulateClientIps ? 'enabled' : 'disabled'}`);
console.log('Press Ctrl+C to stop early.\n');

let stopping = false;
process.on('SIGINT', () => {
  if (stopping) {
    process.exit(130);
  }

  stopping = true;
  state.phase = 'drain';
  console.log('\nStop requested. Registration phase stopped, draining reminder/cancel queues...');
});

await runScheduler();
if (!skipCleanup) {
  await cleanupRemainingRegistrations();
}
printFinalSummary();

async function runScheduler() {
  let lastReportAt = Date.now();

  while (true) {
    const now = Date.now();
    const elapsed = now - state.startedAt;

    if (!stopping && elapsed >= durationMs) {
      state.phase = 'drain';
      stopping = true;
      console.log('\nRegistration phase finished. Draining reminder/cancel queues...');
    }

    const drainElapsed = elapsed - durationMs;
    const drainExpired = state.phase === 'drain' && drainElapsed >= drainMs;

    if (state.phase !== 'drain') {
      dispatchRegistrations(elapsed);
    }

    dispatchReminders(elapsed);
    dispatchCancels(elapsed);

    if (now - lastReportAt >= reportEveryMs) {
      printProgress(elapsed);
      lastReportAt = now;
    }

    if (
      drainExpired &&
      state.reminderQueue.length === 0 &&
      state.cancelQueue.length === 0 &&
      state.running.registrations === 0 &&
      state.running.reminders === 0 &&
      state.running.cancels === 0
    ) {
      break;
    }

    if (drainExpired && state.reminderQueue.length + state.cancelQueue.length > 0) {
      console.log(
        `Drain time expired; pending reminders=${state.reminderQueue.length}, cancels=${state.cancelQueue.length}.`,
      );
      break;
    }

    await sleep(1000);
  }
}

function dispatchRegistrations(elapsedMs) {
  if (state.counters.registrationOk + state.counters.registrationFail >= maxRegistrations) {
    return;
  }

  state.registrationAccumulator += registrationRpsAt(elapsedMs);
  const count = Math.floor(state.registrationAccumulator);
  state.registrationAccumulator -= count;

  for (let index = 0; index < count; index += 1) {
    if (state.nextUserOffset >= users || state.counters.registrationOk + state.counters.registrationFail >= maxRegistrations) {
      return;
    }

    const vkUserId = String(vkUserStart + state.nextUserOffset);
    state.nextUserOffset += 1;
    void registrationFlow(vkUserId);
  }
}

function dispatchReminders(elapsedMs) {
  state.reminderAccumulator += reminderRpsAt(elapsedMs);
  const count = Math.min(Math.floor(state.reminderAccumulator), state.reminderQueue.length);
  state.reminderAccumulator -= count;

  for (let index = 0; index < count; index += 1) {
    const item = state.reminderQueue.shift();
    if (item) {
      void reminderFlow(item);
    }
  }
}

function dispatchCancels(elapsedMs) {
  state.cancelAccumulator += cancelRpsAt(elapsedMs);
  const count = Math.min(Math.floor(state.cancelAccumulator), state.cancelQueue.length);
  state.cancelAccumulator -= count;

  for (let index = 0; index < count; index += 1) {
    const item = state.cancelQueue.shift();
    if (item) {
      void cancelFlow(item);
    }
  }
}

async function registrationFlow(vkUserId) {
  state.running.registrations += 1;
  const authHeaders = authHeadersFor(vkUserId);

  try {
    await measure('profile', () =>
      requestJson('PATCH', '/api/v1/users/me/profile', {
        authHeaders,
        body: {
          fullName: fullNameFor(Number(vkUserId)),
          disclaimerAccepted: true,
        },
        operation: 'profile',
      }),
    );
    state.counters.profileOk += 1;
  } catch (error) {
    state.counters.profileFail += 1;
    recordError('profile', error);
    state.running.registrations -= 1;
    return;
  }

  try {
    const registration = await measure('registration', () =>
      requestJson('POST', '/api/v1/registrations', {
        authHeaders,
        body: {
          eventId,
          registrationFormId: eventCard.activeForm?.id,
          answers: buildAnswers(eventCard.activeForm?.questions ?? []),
          consent: {
            accepted: true,
            version: currentConsent.version,
            textHash: currentConsent.textHash,
          },
        },
        operation: 'registration',
      }),
    );

    state.counters.registrationOk += 1;
    state.createdRegistrations.set(registration.id, {
      authHeaders,
      registrationId: registration.id,
    });
    state.reminderQueue.push({
      authHeaders,
      registrationId: registration.id,
      eventStartAt: eventCard.event.startAt,
    });
  } catch (error) {
    state.counters.registrationFail += 1;
    recordError('registration', error);
  } finally {
    state.running.registrations -= 1;
  }
}

async function reminderFlow(item) {
  state.running.reminders += 1;

  try {
    const remindAt = reminderTimeBefore(item.eventStartAt);
    if (!remindAt) {
      throw new Error('Cannot create reminder: event starts too soon.');
    }

    await measure('reminder', () =>
      requestJson('POST', `/api/v1/reminders/registrations/${item.registrationId}`, {
        authHeaders: item.authHeaders,
        body: { remindAt },
        operation: 'reminder',
      }),
    );

    state.counters.reminderOk += 1;
  } catch (error) {
    state.counters.reminderFail += 1;
    recordError('reminder', error);
  } finally {
    state.cancelQueue.push({
      authHeaders: item.authHeaders,
      registrationId: item.registrationId,
    });
    state.running.reminders -= 1;
  }
}

async function cancelFlow(item) {
  state.running.cancels += 1;

  try {
    await measure('cancel', () =>
      requestJson('PATCH', `/api/v1/registrations/${item.registrationId}/cancel`, {
        authHeaders: item.authHeaders,
        body: { reason: 'Нагрузочный тест: автоматическая отмена записи' },
        operation: 'cancel',
      }),
    );

    state.counters.cancelOk += 1;
    state.canceledRegistrations.add(item.registrationId);
  } catch (error) {
    state.counters.cancelFail += 1;
    recordError('cancel', error);
  } finally {
    state.running.cancels -= 1;
  }
}

async function cleanupRemainingRegistrations() {
  const remaining = Array.from(state.createdRegistrations.values()).filter(
    (item) => !state.canceledRegistrations.has(item.registrationId),
  );

  if (remaining.length === 0) {
    return;
  }

  console.log(`\nCleanup: canceling ${remaining.length} remaining active test registrations at ${cleanupRps} RPS...`);

  let index = 0;
  while (index < remaining.length) {
    const batch = remaining.slice(index, index + cleanupRps);
    await Promise.all(
      batch.map(async (item) => {
        try {
          await requestJson('PATCH', `/api/v1/registrations/${item.registrationId}/cancel`, {
            authHeaders: item.authHeaders,
            body: { reason: 'Нагрузочный тест: финальная очистка тестовой записи' },
            operation: 'cleanup_cancel',
          });
          state.counters.cleanupCancelOk += 1;
          state.canceledRegistrations.add(item.registrationId);
        } catch (error) {
          state.counters.cleanupCancelFail += 1;
          recordError('cleanup_cancel', error);
        }
      }),
    );
    index += batch.length;
    if (index < remaining.length) {
      await sleep(1000);
    }
  }
}

async function findEventByTitle(title, authHeaders) {
  const response = await requestJson('GET', '/api/v1/events?page=1&pageSize=100&sortOrder=asc', {
    authHeaders,
    operation: 'find_event',
  });

  const event = response.items?.find((item) =>
    typeof item.title === 'string' && item.title.toLowerCase().includes(String(title).toLowerCase()),
  );

  if (!event) {
    fail(`Could not find published event by title: ${title}`);
  }

  return event.id;
}

async function getEventCard(id, authHeaders) {
  return requestJson('GET', `/api/v1/events/${id}`, {
    authHeaders,
    operation: 'event_card',
  });
}

function validateEventForWriteTest(card) {
  const startAt = new Date(card.event.startAt);
  const now = new Date();

  if (Number.isNaN(startAt.getTime()) || startAt <= now) {
    fail('Test event should start in the future.');
  }

  if (startAt.getTime() - now.getTime() < 15 * 60 * 1000) {
    console.warn('Warning: event starts in less than 15 minutes; reminders may fail.');
  }

  if (card.event.capacity !== null && card.event.availableSeats < maxRegistrations) {
    console.warn(
      `Warning: event has only ${card.event.availableSeats} available seats; registrations above this number will fail.`,
    );
  }
}

function buildAnswers(questions) {
  return questions.map((question, index) => {
    const base = { questionKey: question.fieldKey };

    switch (question.questionType) {
      case 'EMAIL':
        return { ...base, answerText: `loadtest${index}@example.test` };
      case 'PHONE':
        return { ...base, answerText: '+70000000000' };
      case 'SELECT':
      case 'COURSE':
        return { ...base, answerText: firstOption(question.options) ?? '1 курс' };
      case 'CHECKBOX':
        return { ...base, answerJson: { checked: true, values: [firstOption(question.options) ?? 'yes'] } };
      case 'DATE':
        return { ...base, answerText: new Date().toISOString().slice(0, 10) };
      case 'NUMBER':
        return { ...base, answerText: '1' };
      case 'TEXTAREA':
        return { ...base, answerText: 'Тестовый ответ для нагрузочного сценария' };
      case 'TEXT':
      default:
        return { ...base, answerText: 'Тестовый ответ' };
    }
  });
}

function firstOption(options) {
  if (!Array.isArray(options)) {
    return null;
  }

  const option = options.find((item) => typeof item === 'string' && item.trim().length > 0);
  return option ?? null;
}

async function requestJson(method, urlPath, { authHeaders, body, operation }) {
  const response = await fetch(`${targetOrigin}${urlPath}`, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'Diplom-WriteFlowLoadTest/1.0',
      ...authHeaders,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  recordHttpCode(response.status);

  const contentType = response.headers.get('content-type') ?? '';
  const data = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const error = new Error(
      typeof data === 'object' && data !== null
        ? `${operation} failed: ${response.status} ${data.code ?? data.message ?? 'REQUEST_ERROR'}`
        : `${operation} failed: ${response.status}`,
    );
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

async function measure(operation, callback) {
  const startedAt = performance.now();
  try {
    return await callback();
  } finally {
    const elapsed = performance.now() - startedAt;
    state.timings[operation]?.push(elapsed);
  }
}

function recordHttpCode(status) {
  const current = state.httpCodes.get(status) ?? 0;
  state.httpCodes.set(status, current + 1);
}

function recordError(operation, error) {
  const code = error?.data?.code ?? error?.status ?? error.message ?? 'UNKNOWN';
  const key = `${operation}:${code}`;
  state.errors.set(key, (state.errors.get(key) ?? 0) + 1);
}

function registrationRpsAt(elapsedMs) {
  const minute = elapsedMs / 60000;
  if (minute < 2) return lerp(1, 2, minute / 2);
  if (minute < 5) return 2;
  if (minute < 7) return lerp(2, 1, (minute - 5) / 2);
  if (minute < 9) return 1;
  if (minute < 11) return lerp(1, 3, (minute - 9) / 2);
  if (minute < 13) return 3;
  if (minute < 14) return lerp(3, 1.5, minute - 13);
  return 1.5;
}

function reminderRpsAt(elapsedMs) {
  return Math.min(1, Math.max(0.5, registrationRpsAt(elapsedMs) / 3));
}

function cancelRpsAt(elapsedMs) {
  return Math.min(1, Math.max(0.5, registrationRpsAt(elapsedMs) / 3));
}

function lerp(from, to, ratio) {
  return from + (to - from) * Math.min(Math.max(ratio, 0), 1);
}

function reminderTimeBefore(eventStartAt) {
  const start = new Date(eventStartAt).getTime();
  const now = Date.now();
  const oneHourFromNow = now + 60 * 60 * 1000;
  const fiveMinutesBeforeStart = start - 5 * 60 * 1000;
  const remindAt = Math.min(oneHourFromNow, fiveMinutesBeforeStart);

  if (remindAt <= now + 30 * 1000) {
    return null;
  }

  return new Date(remindAt).toISOString();
}

function authHeadersFor(vkUserId) {
  const headers = {
    'X-VK-Launch-Params': createLaunchParams(vkUserId),
  };

  if (simulateClientIps) {
    headers['X-Forwarded-For'] = syntheticIpFor(vkUserId);
  }

  return headers;
}

function createLaunchParams(vkUserId) {
  const params = {
    vk_app_id: vkAppId,
    vk_user_id: String(vkUserId),
    vk_platform: 'desktop_web',
    vk_language: 'ru',
    vk_ts: String(Math.floor(Date.now() / 1000)),
  };

  const payload = Object.entries(params)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');

  const sign = createHmac('sha256', vkSecret)
    .update(payload)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return new URLSearchParams({ ...params, sign }).toString();
}

function fullNameFor(seed) {
  const firstNames = ['Иван', 'Петр', 'Алексей', 'Максим', 'Сергей', 'Андрей', 'Никита', 'Даниил'];
  const lastNames = ['Иванов', 'Петров', 'Сидоров', 'Смирнов', 'Кузнецов', 'Попов', 'Васильев', 'Соколов'];
  return `${lastNames[seed % lastNames.length]} ${firstNames[seed % firstNames.length]}`;
}

function syntheticIpFor(vkUserId) {
  const value = Number(vkUserId);
  const third = Math.floor(value / 250) % 250;
  const fourth = value % 250;
  return `10.250.${third}.${fourth}`;
}

function printProgress(elapsedMs) {
  const prefix = `[${formatDuration(Math.min(elapsedMs, durationMs))}/${formatDuration(durationMs)} ${state.phase}]`;
  console.log(
    [
      prefix,
      `reg ok=${state.counters.registrationOk} fail=${state.counters.registrationFail} run=${state.running.registrations}`,
      `rem ok=${state.counters.reminderOk} fail=${state.counters.reminderFail} q=${state.reminderQueue.length}`,
      `cancel ok=${state.counters.cancelOk} fail=${state.counters.cancelFail} q=${state.cancelQueue.length}`,
      `p95 reg=${Math.round(percentile(state.timings.registration, 95))}ms`,
    ].join(' | '),
  );
}

function printFinalSummary() {
  console.log('\nFinal write-flow summary');
  console.log(`Target: ${targetOrigin}`);
  console.log(`Event ID: ${eventId}`);
  console.log(`Profiles: ok=${state.counters.profileOk}, fail=${state.counters.profileFail}`);
  console.log(`Registrations: ok=${state.counters.registrationOk}, fail=${state.counters.registrationFail}`);
  console.log(`Reminders: ok=${state.counters.reminderOk}, fail=${state.counters.reminderFail}`);
  console.log(`Cancels: ok=${state.counters.cancelOk}, fail=${state.counters.cancelFail}`);
  console.log(`Cleanup cancels: ok=${state.counters.cleanupCancelOk}, fail=${state.counters.cleanupCancelFail}`);
  console.log(`Pending reminders=${state.reminderQueue.length}, pending cancels=${state.cancelQueue.length}`);
  console.log(`HTTP codes: ${formatMap(state.httpCodes)}`);

  for (const operation of Object.keys(state.timings)) {
    const values = state.timings[operation];
    if (values.length === 0) {
      continue;
    }

    console.log(
      `${operation}: count=${values.length}, avg=${Math.round(avg(values))}ms, p95=${Math.round(percentile(values, 95))}ms, p99=${Math.round(percentile(values, 99))}ms`,
    );
  }

  if (state.errors.size > 0) {
    console.log(`Errors: ${formatMap(state.errors)}`);
  }

  console.log('\nNote: synthetic users, consents and cancellation/audit logs remain in the database for auditability.');
}

function formatMap(map) {
  return Array.from(map.entries())
    .sort(([left], [right]) => String(left).localeCompare(String(right)))
    .map(([key, value]) => `${key}=${value}`)
    .join(', ') || 'none';
}

function avg(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile(values, percentileValue) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil((percentileValue / 100) * sorted.length) - 1);
  return sorted[index];
}

function parseDuration(value) {
  if (typeof value === 'number') {
    return value;
  }

  const match = String(value).trim().match(/^(\d+(?:\.\d+)?)(ms|s|m)$/);
  if (!match) {
    fail(`Invalid duration: ${value}. Use 500ms, 10s or 15m.`);
  }

  const amount = Number(match[1]);
  const unit = match[2];
  if (unit === 'ms') return amount;
  if (unit === 's') return amount * 1000;
  return amount * 60 * 1000;
}

function formatDuration(ms) {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeOrigin(value) {
  return new URL(value).origin;
}

function toPositiveInt(value, fallback) {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function loadEnvFile(envPath) {
  if (!existsSync(envPath)) {
    return;
  }

  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function parseArgs(rawArgs) {
  const result = {};
  for (let index = 0; index < rawArgs.length; index += 1) {
    const current = rawArgs[index];
    if (!current.startsWith('--')) {
      continue;
    }

    const rawKey = current.slice(2);
    const [key, inlineValue] = rawKey.split('=');
    const normalizedKey = toCamelCase(key);
    if (key === 'confirm-write-test' || key === 'skip-cleanup' || key === 'simulate-client-ips' || key === 'help') {
      result[normalizedKey] = inlineValue === undefined ? true : inlineValue !== 'false';
      continue;
    }

    result[normalizedKey] = inlineValue ?? rawArgs[index + 1];
    if (inlineValue === undefined) {
      index += 1;
    }
  }
  return result;
}

function toCamelCase(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function printHelp() {
  console.log(`
Controlled write-flow load test.

Required:
  --confirm-write-test
  --event-id <uuid> OR --find-event-title "Нагрузочный тест"

Examples:
  node load-testing/write-flow/write-flow.mjs --target https://event-iknk.ru --find-event-title "Нагрузочный тест" --duration 15m --users 2000 --simulate-client-ips --confirm-write-test
  node load-testing/write-flow/write-flow.mjs --target https://event-iknk.ru --event-id <uuid> --duration 2m --max-registrations 60 --confirm-write-test

Environment:
  VK_APP_SECRET is required for signed VK launch params.
  VK_APP_ID is optional and defaults to 0.
`);
}
