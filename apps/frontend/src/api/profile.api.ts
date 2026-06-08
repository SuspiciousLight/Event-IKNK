import { apiRequest } from './client';
import { ProfileDisclaimerDto, UserProfileDto } from './contracts';

export type UpdateProfilePayload = Pick<UserProfileDto, 'fullName'> & {
  telegramUsername?: string;
  disclaimerAccepted?: boolean;
};

export const profileApi = {
  getProfileDisclaimer: () => apiRequest<ProfileDisclaimerDto>('/users/profile-disclaimer'),

  getMyProfile: () => apiRequest<UserProfileDto>('/users/me/profile'),

  updateMyProfile: (payload: UpdateProfilePayload) =>
    apiRequest<UserProfileDto>('/users/me/profile', {
      method: 'PATCH',
      body: payload,
    }),
};
