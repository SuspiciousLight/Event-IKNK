import { apiRequest } from './client';
import { ReminderDto } from './contracts';

export const remindersApi = {
  getForRegistration: (registrationId: string) =>
    apiRequest<ReminderDto | null>(`/reminders/registrations/${registrationId}`),

  setForRegistration: (registrationId: string, remindAt: string) =>
    apiRequest<ReminderDto>(`/reminders/registrations/${registrationId}`, {
      method: 'POST',
      body: { remindAt },
    }),

  cancelForRegistration: (registrationId: string) =>
    apiRequest<ReminderDto>(`/reminders/registrations/${registrationId}/cancel`, {
      method: 'PATCH',
    }),
};
