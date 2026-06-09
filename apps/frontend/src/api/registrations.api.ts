import { apiRequest, buildQueryString } from './client';
import {
  PaginatedResponseDto,
  RegistrationCreateDto,
  RegistrationCreatedDto,
  RegistrationListItemDto,
} from './contracts';

export const registrationsApi = {
  create: (payload: RegistrationCreateDto) =>
    apiRequest<RegistrationCreatedDto>('/registrations', {
      method: 'POST',
      body: payload,
    }),

  cancel: (registrationId: string, reason?: string) =>
    apiRequest<RegistrationListItemDto>(`/registrations/${registrationId}/cancel`, {
      method: 'PATCH',
      body: { reason },
    }),

  resume: (registrationId: string) =>
    apiRequest<RegistrationListItemDto>(`/registrations/${registrationId}/resume`, {
      method: 'PATCH',
    }),

  listMy: (params?: {
    page?: number;
    pageSize?: number;
    status?: 'ACTIVE' | 'CANCELED';
    scope?: 'active' | 'archive' | 'all';
  }) =>
    apiRequest<PaginatedResponseDto<RegistrationListItemDto>>(
      `/registrations/me${buildQueryString(params ?? {})}`,
    ),
};
