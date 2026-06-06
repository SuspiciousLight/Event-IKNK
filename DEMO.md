# Demo without VK Tunnel

VK Tunnel is currently not a reliable option. Cloudflare Quick Tunnel may also be unavailable from some Russian networks without VPN, so the project supports several demo paths:

- recommended for defense: public HTTPS deployment of frontend + backend;
- fallback tunnel: localtunnel;
- fallback SSH tunnel: Pinggy over port `443`;
- Cloudflare Quick Tunnel only if it is reachable in your network.

## 1. Project stack

- Frontend: Vite + React + TypeScript.
- UI: VKUI.
- VK layer: `@vkontakte/vk-bridge`.
- Router: React Router with hash routes.
- Backend: NestJS API.
- Local frontend dev port: `5173`.
- Local frontend preview port: `4173`.
- Local backend port: `3000`.

VK Bridge initialization is already present in `apps/frontend/src/vk/bridge.ts` through `VKWebAppInit`.

## 2. Install dependencies

The repository is a pnpm monorepo. Use pnpm for installation:

```powershell
corepack enable
corepack pnpm install
```

After dependencies are installed, root `npm run ...` commands can still be used because the scripts call pnpm internally.

## 3. Production-style frontend demo

Use this mode when the backend API is already public, for example deployed to Render:

```powershell
$env:VITE_API_URL="https://YOUR_BACKEND_DOMAIN/api/v1"
npm run build
npm run preview
```

In another terminal:

```powershell
npm run tunnel:cf
```

Cloudflare will print a public HTTPS URL similar to:

```text
https://example-name.trycloudflare.com
```

Use this HTTPS URL in VK Mini Apps settings.

Important: if `VITE_API_URL` is not set during build, production preview will call `/api/v1` on the same frontend host. That works only if a reverse proxy is configured. For local backend demo, use the dev-proxy mode below.

## 4. Full local demo with local backend

Use this mode when both frontend and backend are running locally.

Start PostgreSQL and backend first:

```powershell
docker compose -f infra/docker-compose.yml up -d
corepack pnpm --filter backend prisma:migrate
corepack pnpm --filter backend prisma:seed
corepack pnpm --filter backend dev
```

Then start frontend dev server with Vite proxy:

```powershell
npm run dev
```

In another terminal, expose the frontend dev server:

```powershell
npm run tunnel:cf:dev
```

In this mode the public Cloudflare URL points to frontend port `5173`, and Vite proxies `/api/*` to local backend `http://localhost:3000`.

If your backend is running on another local address, set:

```powershell
$env:VITE_PROXY_API_TARGET="http://localhost:3000"
npm run dev
```

## 5. If Cloudflare does not work in Russia

The most reliable option is not a tunnel. Deploy the app to public HTTPS hosting:

1. Deploy PostgreSQL and backend to a public server or platform.
2. Set frontend build env:

```powershell
$env:VITE_API_URL="https://YOUR_BACKEND_DOMAIN/api/v1"
npm run build
```

3. Upload `apps/frontend/dist` to any HTTPS static hosting.
4. Put the frontend HTTPS URL into VK Mini Apps settings.

Good practical options for a diploma demo:

- Russian VPS or hosting with Nginx + HTTPS certificate.
- Timeweb Cloud / Selectel / Beget Cloud / any VPS where you can open ports `80/443`.
- Separate frontend static hosting plus public backend API.

This avoids VPN dependency and temporary tunnel failures.

## 6. Cloudflare Quick Tunnel

Main command:

```powershell
cloudflared tunnel --url http://localhost:4173
```

If `cloudflared` is not installed on Windows, install it with one of these options:

```powershell
winget install --id Cloudflare.cloudflared
```

Or download the binary from Cloudflare documentation and add it to `PATH`.

Temporary npx option, if available in your environment:

```powershell
npx cloudflared@latest tunnel --url http://localhost:4173
```

For local backend through Vite dev proxy use port `5173`:

```powershell
cloudflared tunnel --url http://localhost:5173
```

## 7. Fallback: localtunnel

If Cloudflare Quick Tunnel is unavailable:

```powershell
npm run tunnel:lt
```

For local backend through Vite dev proxy:

```powershell
npm run tunnel:lt:dev
```

localtunnel will print an HTTPS URL, usually on the `loca.lt` domain.

## 8. Fallback: Pinggy SSH tunnel

If localtunnel is also unavailable, try Pinggy over SSH port `443`:

```powershell
npm run tunnel:pinggy
```

For local backend through Vite dev proxy:

```powershell
npm run tunnel:pinggy:dev
```

Pinggy will print a public HTTPS URL. Keep the terminal open while demonstrating.

## 9. Where to put the URL in VK Mini Apps

Open VK Mini Apps management:

```text
Настройки приложения -> Тестирование -> Тестовая группа -> URL
```

Paste the HTTPS URL printed by Cloudflare or localtunnel.

Example:

```text
https://example-name.trycloudflare.com
```

For a deployed version, only the deployed servers must stay running. For a tunnel version, the local frontend server and tunnel process must stay running during the whole demonstration.

## 10. Security notes

- Do not use VK Tunnel for this demo path.
- Do not put `VK_APP_SECRET`, `JWT_SECRET`, database URLs, admin passwords, or private keys into frontend code.
- `VITE_API_URL` is public by design and can contain only the public backend API URL.
- Admin JWT remains in an HttpOnly cookie and must not be stored in `localStorage` or `sessionStorage`.
- For the diploma defense, prefer a stable HTTPS frontend and backend domain instead of temporary tunnel URLs.

## 11. Quick command summary

Frontend-only production preview with public backend:

```powershell
$env:VITE_API_URL="https://YOUR_BACKEND_DOMAIN/api/v1"
npm run build
npm run preview
npm run tunnel:cf
```

Full local demo with local backend:

```powershell
corepack pnpm --filter backend dev
npm run dev
npm run tunnel:lt:dev
```

SSH fallback:

```powershell
corepack pnpm --filter backend dev
npm run dev
npm run tunnel:pinggy:dev
```
