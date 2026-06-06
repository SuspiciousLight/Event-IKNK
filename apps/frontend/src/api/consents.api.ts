import { apiRequest, buildQueryString } from './client';
import { ConsentDocumentDto, ConsentRecordDto } from './contracts';

type AcceptConsentPayload = {
  consentVersion: string;
  consentTextHash: string;
  eventId?: string;
  eventRegistrationId?: string;
};

export const consentsApi = {
  getCurrent: () => apiRequest<ConsentDocumentDto>('/consents/current'),

  listMy: (params?: { eventId?: string; eventRegistrationId?: string }) =>
    apiRequest<ConsentRecordDto[]>(`/consents/me${buildQueryString(params ?? {})}`),

  accept: (payload: AcceptConsentPayload) =>
    apiRequest<ConsentRecordDto>('/consents', {
      method: 'POST',
      body: payload,
    }),
};
