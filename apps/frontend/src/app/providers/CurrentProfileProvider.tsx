import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { HttpError } from '../../api/client';
import { ProfileDisclaimerDto, UserProfileDto } from '../../api/contracts';
import { profileApi, UpdateProfilePayload } from '../../api/profile.api';

type CurrentProfileContextValue = {
  profile: UserProfileDto | null;
  disclaimer: ProfileDisclaimerDto | null;
  loading: boolean;
  disclaimerLoading: boolean;
  error: string | null;
  hasProfile: boolean;
  reloadProfile: () => Promise<UserProfileDto | null>;
  reloadDisclaimer: () => Promise<ProfileDisclaimerDto | null>;
  saveProfile: (payload: UpdateProfilePayload) => Promise<UserProfileDto>;
};

const CurrentProfileContext = createContext<CurrentProfileContextValue | null>(null);

export const CurrentProfileProvider = ({ children }: { children: ReactNode }) => {
  const [profile, setProfile] = useState<UserProfileDto | null>(null);
  const [disclaimer, setDisclaimer] = useState<ProfileDisclaimerDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [disclaimerLoading, setDisclaimerLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reloadDisclaimer = useCallback(async () => {
    setDisclaimerLoading(true);

    try {
      const response = await profileApi.getProfileDisclaimer();
      setDisclaimer(response);
      return response;
    } catch (requestError: unknown) {
      setDisclaimer(null);
      return null;
    } finally {
      setDisclaimerLoading(false);
    }
  }, []);

  const reloadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await profileApi.getMyProfile();
      setProfile(response);
      return response;
    } catch (requestError: unknown) {
      if (requestError instanceof HttpError && requestError.status === 404) {
        setProfile(null);
        return null;
      }

      const message = requestError instanceof Error ? requestError.message : 'Не удалось загрузить профиль';
      setError(message);
      throw requestError;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reloadProfile().catch(() => undefined);
    void reloadDisclaimer().catch(() => undefined);
  }, [reloadDisclaimer, reloadProfile]);

  const saveProfile = useCallback(async (payload: UpdateProfilePayload) => {
    const response = await profileApi.updateMyProfile(payload);
    setProfile(response);
    setError(null);
    return response;
  }, []);

  const value = useMemo<CurrentProfileContextValue>(
    () => ({
      profile,
      disclaimer,
      loading,
      disclaimerLoading,
      error,
      hasProfile: Boolean(profile),
      reloadProfile,
      reloadDisclaimer,
      saveProfile,
    }),
    [disclaimer, disclaimerLoading, error, loading, profile, reloadDisclaimer, reloadProfile, saveProfile],
  );

  return <CurrentProfileContext.Provider value={value}>{children}</CurrentProfileContext.Provider>;
};

export const useCurrentProfile = () => {
  const context = useContext(CurrentProfileContext);
  if (!context) {
    throw new Error('useCurrentProfile must be used within CurrentProfileProvider');
  }

  return context;
};
