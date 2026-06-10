import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiDownload, apiRequest, buildQueryString, configureApiClient, HttpError } from './client';

const mockFetch = () => vi.mocked(fetch);

describe('frontend API client', () => {
  afterEach(() => {
    configureApiClient({ vkUserId: null, launchParamsRaw: '' });
    vi.unstubAllGlobals();
  });

  it('builds query strings without empty values', () => {
    expect(buildQueryString({
      page: 2,
      q: 'career',
      onlyActive: true,
      empty: '',
      nil: null,
      absent: undefined,
    })).toBe('?page=2&q=career&onlyActive=true');
  });

  it('sends VK identity headers and keeps admin auth in HttpOnly cookie flow', async () => {
    configureApiClient({
      vkUserId: 375974566,
      launchParamsRaw: 'vk_user_id=375974566&sign=test-signature',
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ));

    const result = await apiRequest<{ success: boolean }>('/profile', {
      method: 'PATCH',
      body: { fullName: 'Иванов Иван' },
    });

    expect(result).toEqual({ success: true });
    expect(mockFetch()).toHaveBeenCalledWith('/api/v1/profile', expect.objectContaining({
      method: 'PATCH',
      credentials: 'include',
      body: JSON.stringify({ fullName: 'Иванов Иван' }),
      headers: expect.objectContaining({
        'Content-Type': 'application/json',
        'X-Requested-With': 'VKMiniApp',
        'X-VK-User-Id': '375974566',
        'X-VK-Launch-Params': encodeURIComponent('vk_user_id=375974566&sign=test-signature'),
      }),
    }));
  });

  it('throws typed HttpError with backend error details', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        code: 'VALIDATION_ERROR',
        message: 'Некорректные данные',
        details: { field: 'fullName' },
      }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      }),
    ));

    await expect(apiRequest('/profile', { method: 'PATCH', body: { fullName: '123' } })).rejects.toMatchObject({
      status: 400,
      message: 'Некорректные данные',
      code: 'VALIDATION_ERROR',
      details: { field: 'fullName' },
    });
  });

  it('returns undefined for 204 responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));

    await expect(apiRequest<void>('/registrations/registration-1/cancel', { method: 'PATCH' })).resolves.toBeUndefined();
  });

  it('downloads blobs through the same trusted cookie-based request channel', async () => {
    const blob = new Blob(['excel']);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(blob, { status: 200 })));

    await expect(apiDownload('/admin/events/event-1/registrations/export')).resolves.toBeInstanceOf(Blob);
    expect(mockFetch()).toHaveBeenCalledWith(
      '/api/v1/admin/events/event-1/registrations/export',
      expect.objectContaining({
        method: 'GET',
        credentials: 'include',
        headers: expect.objectContaining({
          'X-Requested-With': 'VKMiniApp',
        }),
      }),
    );
  });

  it('uses HttpError for failed downloads', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('forbidden', { status: 403 })));

    await expect(apiDownload('/admin/events/event-1/registrations/export')).rejects.toBeInstanceOf(HttpError);
  });
});
