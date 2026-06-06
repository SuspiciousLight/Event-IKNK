import { apiRequest } from './client';
import { AuthMeResponseDto } from './contracts';

export type AdminLoginPayload = {
  login: string;
  password: string;
};

export const authApi = {
  loginAdmin: (payload: AdminLoginPayload) =>
    apiRequest<AuthMeResponseDto>('/auth/admin/login', {
      method: 'POST',
      body: payload,
    }),

  logoutAdmin: () =>
    apiRequest<{ success: boolean }>('/auth/admin/logout', {
      method: 'POST',
    }),

  me: () => apiRequest<AuthMeResponseDto>('/auth/me'),
};
