import { apiDownload, apiRequest, buildQueryString } from './client';
import {
  AdminEventDto,
  AdminFormTemplateDto,
  AdminQuestionPayloadDto,
  AdminRegistrationRowDto,
  AuditLogDto,
  NotificationCampaignDto,
  PaginatedResponseDto,
} from './contracts';

type RegistrationsQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: 'ACTIVE' | 'CANCELED';
  includeCanceled?: boolean;
  sortBy?: 'registeredAt' | 'canceledAt' | 'fullName';
  sortOrder?: 'asc' | 'desc';
};

type EventPayload = {
  title: string;
  description?: string;
  startAt: string;
  endAt: string;
  location?: string;
  capacity?: number;
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
};

type RegistrationFormPayload = {
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  sourceTemplateId?: string;
  questions: AdminQuestionPayloadDto[];
};

type TemplatePayload = {
  templateCode: string;
  name: string;
  description?: string;
  questions: AdminQuestionPayloadDto[];
};

export const adminApi = {
  listEvents: (query?: { page?: number; pageSize?: number; search?: string; status?: string }) =>
    apiRequest<PaginatedResponseDto<AdminEventDto>>(`/admin/events${buildQueryString(query ?? {})}`),

  createEvent: (payload: EventPayload) =>
    apiRequest<AdminEventDto>('/admin/events', {
      method: 'POST',
      body: payload,
    }),

  deleteEvent: (eventId: string) =>
    apiRequest<{ id: string; deletedAt: string }>(`/admin/events/${eventId}`, {
      method: 'DELETE',
    }),

  createRegistrationForm: (eventId: string, payload: RegistrationFormPayload) =>
    apiRequest<{ id: string; eventId: string; version: number; status: string }>(`/admin/events/${eventId}/forms`, {
      method: 'POST',
      body: payload,
    }),

  listFormTemplates: (query?: { page?: number; pageSize?: number; search?: string }) =>
    apiRequest<PaginatedResponseDto<AdminFormTemplateDto>>(`/admin/form-templates${buildQueryString(query ?? {})}`),

  createFormTemplate: (payload: TemplatePayload) =>
    apiRequest<AdminFormTemplateDto>('/admin/form-templates', {
      method: 'POST',
      body: payload,
    }),

  createEventFromTemplate: (payload: EventPayload & { templateId: string; formStatus?: 'DRAFT' | 'PUBLISHED' }) =>
    apiRequest<{ eventId: string; formId: string }>('/admin/events/from-template', {
      method: 'POST',
      body: payload,
    }),

  getEventRegistrations: (eventId: string, query?: RegistrationsQuery) =>
    apiRequest<PaginatedResponseDto<AdminRegistrationRowDto>>(
      `/admin/events/${eventId}/registrations${buildQueryString(query ?? {})}`,
    ),

  updateRegistrationStatus: (eventId: string, registrationId: string, status: 'ACTIVE' | 'CANCELED') =>
    apiRequest<AdminRegistrationRowDto>(`/admin/events/${eventId}/registrations/${registrationId}/status`, {
      method: 'PATCH',
      body: { status },
    }),

  exportEventRegistrationsExcel: async (eventId: string, includeCanceled?: boolean) => {
    const query = buildQueryString({ includeCanceled });
    return apiDownload(`/admin/events/${eventId}/registrations/excel${query}`);
  },

  createCampaign: (eventId: string, payload: { title: string; message: string; status?: 'DRAFT' | 'QUEUED' }) =>
    apiRequest<NotificationCampaignDto>(`/admin/events/${eventId}/campaigns`, {
      method: 'POST',
      body: payload,
    }),

  listAuditLogs: (query?: { page?: number; pageSize?: number; action?: string; targetType?: string }) =>
    apiRequest<PaginatedResponseDto<AuditLogDto>>(`/admin/audit-logs${buildQueryString(query ?? {})}`),
};
