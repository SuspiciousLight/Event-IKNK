import { ApiErrorDto } from '@diplom/shared';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? '/api/v1';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

type RequestOptions = {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
};

type ApiClientContext = {
  vkUserId: number | null;
  launchParamsRaw: string;
};

const apiContext: ApiClientContext = {
  vkUserId: null,
  launchParamsRaw: '',
};

export const configureApiClient = (context: ApiClientContext) => {
  apiContext.vkUserId = context.vkUserId;
  apiContext.launchParamsRaw = context.launchParamsRaw;
};

export class HttpError extends Error {
  readonly status: number;
  readonly details?: unknown;
  readonly code?: string;

  constructor(status: number, message: string, details?: unknown, code?: string) {
    super(message);
    this.status = status;
    this.details = details;
    this.code = code;
  }
}

const buildHeaders = (headers?: Record<string, string>): Record<string, string> => {
  const merged: Record<string, string> = {
    'X-Requested-With': 'VKMiniApp',
    ...headers,
  };

  if (apiContext.vkUserId) {
    merged['X-VK-User-Id'] = String(apiContext.vkUserId);
  }

  if (apiContext.launchParamsRaw) {
    merged['X-VK-Launch-Params'] = encodeURIComponent(apiContext.launchParamsRaw);
  }

  return merged;
};

export const buildQueryString = (params: Record<string, string | number | boolean | null | undefined>) => {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') {
      continue;
    }
    query.set(key, String(value));
  }

  const result = query.toString();
  return result ? `?${result}` : '';
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const isJsonBody = options.body !== undefined && options.body !== null;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    credentials: 'include',
    headers: {
      ...(isJsonBody ? { 'Content-Type': 'application/json' } : {}),
      ...buildHeaders(options.headers),
    },
    body: isJsonBody ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const fallbackMessage = `HTTP ${response.status}`;
    let message = fallbackMessage;
    let code: string | undefined;
    let details: unknown;

    try {
      const payload = (await response.json()) as ApiErrorDto & { details?: unknown };
      message = payload.message || fallbackMessage;
      code = payload.code;
      details = payload.details;
    } catch {
      message = fallbackMessage;
    }

    throw new HttpError(response.status, message, details, code);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return (await response.json()) as T;
  }

  return undefined as T;
}

export async function apiDownload(path: string): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'GET',
    credentials: 'include',
    headers: buildHeaders(),
  });

  if (!response.ok) {
    throw new HttpError(response.status, `Download failed with status ${response.status}`);
  }

  return response.blob();
}
