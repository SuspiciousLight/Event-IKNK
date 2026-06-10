#!/usr/bin/env node
import { createHmac } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

loadEnvFile(path.join(repoRoot, '.env'));

const args = parseArgs(process.argv.slice(2));
const targetOrigin = normalizeOrigin(args.target ?? process.env.LOADTEST_TARGET ?? 'https://event-iknk.ru');
const targetUrl = new URL(targetOrigin);
const hostHeader = targetUrl.host;
const vkAppId = String(args.appId ?? process.env.VK_APP_ID ?? '0');
const vkSecret = process.env.VK_APP_SECRET;
const userCount = toPositiveInt(args.users ?? process.env.LOADTEST_USER_COUNT, 250);
const requestCount = toPositiveInt(args.requests ?? process.env.LOADTEST_AMMO_REQUESTS, 5000);
const vkUserStart = toPositiveInt(args.vkUserStart ?? process.env.LOADTEST_VK_USER_START, 990000000000);
const outputFile = path.resolve(__dirname, args.output ?? 'ammo-prod-realistic.generated.phantom');
let seed = 42;

if (!vkSecret) {
  throw new Error('VK_APP_SECRET is required. Put it into root .env or export it before running the generator.');
}

const firstLaunchParams = createLaunchParams(vkUserStart);
const assets = await discoverFrontendAssets();
const eventIds = await discoverEventIds(firstLaunchParams);
const requestFactories = createRequestFactories(assets, eventIds);
const ammo = buildAmmo(requestFactories);

writeFileSync(outputFile, ammo, 'utf8');

console.log(`Generated realistic ammo: ${outputFile}`);
console.log(`Target: ${targetOrigin}`);
console.log(`Synthetic VK users: ${userCount}`);
console.log(`Requests in ammo cycle: ${requestCount}`);
console.log(`Discovered event cards: ${eventIds.length}`);
console.log(`Frontend assets: ${assets.join(', ') || 'none'}`);

function buildAmmo(factories) {
  let output = '';
  for (let index = 0; index < requestCount; index += 1) {
    const factory = factories[Math.floor(random() * factories.length)];
    const vkUserId = String(vkUserStart + (index % userCount));
    output += makeRequest(factory(vkUserId));
  }
  return output;
}

function createRequestFactories(assets, eventIds) {
  const factories = [];
  const add = (weight, factory) => {
    for (let index = 0; index < weight; index += 1) {
      factories.push(factory);
    }
  };

  add(14, () => request('GET', '/', 'frontend_index'));
  add(5, () => request('GET', '/privacy-policy.html', 'privacy_policy'));
  add(5, () => request('GET', '/user-agreement.html', 'user_agreement'));
  add(5, () => request('GET', '/api/v1/health', 'health'));
  add(18, (vkUserId) => request('GET', '/api/v1/events?page=1&pageSize=20&sortOrder=asc', 'events_list', vkUserId));
  add(8, (vkUserId) => request('GET', '/api/v1/registrations/me?page=1&pageSize=10&scope=active', 'my_active_registrations', vkUserId));
  add(5, (vkUserId) => request('GET', '/api/v1/registrations/me?page=1&pageSize=10&scope=archive', 'my_archive_registrations', vkUserId));
  add(5, (vkUserId) => request('GET', '/api/v1/consents/current', 'current_consent', vkUserId));
  add(3, (vkUserId) => request('GET', '/api/v1/consents/me', 'my_consents', vkUserId));
  add(4, () => request('GET', '/api/v1/users/profile-disclaimer', 'profile_disclaimer'));

  for (const asset of assets) {
    add(asset.endsWith('.js') || asset.endsWith('.css') ? 7 : 2, () => request('GET', asset, `asset_${tagFromPath(asset)}`));
  }

  if (eventIds.length > 0) {
    add(16, (vkUserId) => {
      const eventId = pick(eventIds);
      return request('GET', `/api/v1/events/${eventId}`, 'event_card', vkUserId);
    });

    add(4, (vkUserId) => {
      const eventId = pick(eventIds);
      return request('GET', `/api/v1/events/${eventId}/waitlist`, 'waitlist_status', vkUserId);
    });
  }

  return factories;
}

function request(method, urlPath, tag, vkUserId) {
  return {
    method,
    path: urlPath,
    tag,
    headers: {
      Host: hostHeader,
      'User-Agent': 'YandexTank-Diplom-Realistic/1.0',
      Accept: 'text/html,application/json,*/*',
      Connection: 'close',
      Referer: `${targetOrigin}/`,
      ...(vkUserId ? { 'X-VK-Launch-Params': createLaunchParams(vkUserId) } : {}),
    },
  };
}

function makeRequest(spec) {
  const headers = Object.entries(spec.headers)
    .map(([name, value]) => `${name}: ${value}`)
    .join('\r\n');
  const body = spec.body ? JSON.stringify(spec.body) : '';
  const contentHeaders = body
    ? `\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(body)}`
    : '';
  const rawRequest = `${spec.method} ${spec.path} HTTP/1.1\r\n${headers}${contentHeaders}\r\n\r\n${body}`;
  return `${Buffer.byteLength(rawRequest)} ${spec.tag}\n${rawRequest}\r\n`;
}

async function discoverFrontendAssets() {
  try {
    const html = await fetchText('/');
    const assets = new Set(['/logo.png']);
    const assetPattern = /(?:src|href)="([^"]+)"/g;
    let match;
    while ((match = assetPattern.exec(html)) !== null) {
      const assetPath = match[1];
      if (assetPath.startsWith('/assets/') || assetPath === '/logo.png' || assetPath === '/logo.svg') {
        assets.add(assetPath);
      }
    }
    return Array.from(assets);
  } catch (error) {
    console.warn(`Could not discover frontend assets, fallback will be used: ${error.message}`);
    return ['/logo.png'];
  }
}

async function discoverEventIds(launchParams) {
  try {
    const response = await fetchJson('/api/v1/events?page=1&pageSize=20&sortOrder=asc', launchParams);
    return Array.isArray(response.items)
      ? response.items
          .map((item) => item?.id)
          .filter((id) => typeof id === 'string' && id.length > 0)
      : [];
  } catch (error) {
    console.warn(`Could not discover events, event card requests will be skipped: ${error.message}`);
    return [];
  }
}

async function fetchText(urlPath) {
  const response = await fetch(`${targetOrigin}${urlPath}`, {
    headers: { 'User-Agent': 'YandexTank-Diplom-AmmoGenerator/1.0' },
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.text();
}

async function fetchJson(urlPath, launchParams) {
  const response = await fetch(`${targetOrigin}${urlPath}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'YandexTank-Diplom-AmmoGenerator/1.0',
      'X-VK-Launch-Params': launchParams,
    },
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.json();
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

    const [key, inlineValue] = current.slice(2).split('=');
    result[toCamelCase(key)] = inlineValue ?? rawArgs[index + 1];
    if (inlineValue === undefined) {
      index += 1;
    }
  }
  return result;
}

function toCamelCase(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function toPositiveInt(value, fallback) {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function normalizeOrigin(value) {
  const url = new URL(value);
  return url.origin;
}

function pick(items) {
  return items[Math.floor(random() * items.length)];
}

function tagFromPath(value) {
  return value.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 64) || 'file';
}

function random() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}
