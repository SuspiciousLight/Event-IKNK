import { apiRequest, buildQueryString } from './client';
import { EventCardResponseDto, EventSummaryDto, PaginatedResponseDto, WaitlistStatusDto } from './contracts';

export const eventsApi = {
  list: (params?: { page?: number; pageSize?: number; search?: string }) =>
    apiRequest<PaginatedResponseDto<EventSummaryDto>>(`/events${buildQueryString(params ?? {})}`),

  getById: (eventId: string) => apiRequest<EventCardResponseDto>(`/events/${eventId}`),

  getWaitlistStatus: (eventId: string) => apiRequest<WaitlistStatusDto>(`/events/${eventId}/waitlist`),

  subscribeToWaitlist: (eventId: string) =>
    apiRequest<WaitlistStatusDto>(`/events/${eventId}/waitlist`, {
      method: 'POST',
    }),

  cancelWaitlist: (eventId: string) =>
    apiRequest<WaitlistStatusDto>(`/events/${eventId}/waitlist`, {
      method: 'DELETE',
    }),
};
