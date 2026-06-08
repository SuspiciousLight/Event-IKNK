import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useCurrentProfile } from '../app/providers/CurrentProfileProvider';

export type ProfileFormState = {
  lastName: string;
  firstName: string;
};

const EMPTY_PROFILE: ProfileFormState = {
  lastName: '',
  firstName: '',
};

const NAME_PART_REGEX = /^\p{L}[\p{L}'\u2019-]{1,63}$/u;

const splitFullName = (fullName: string): Pick<ProfileFormState, 'lastName' | 'firstName'> => {
  const [lastName = '', firstName = ''] = fullName.trim().split(/\s+/);
  return {
    lastName,
    firstName,
  };
};

const buildFullName = (profile: ProfileFormState): string =>
  [profile.lastName.trim(), profile.firstName.trim()].filter(Boolean).join(' ');

export const useProfileAutofill = () => {
  const currentProfile = useCurrentProfile();
  const [profile, setProfile] = useState<ProfileFormState>(EMPTY_PROFILE);
  const [disclaimerAcknowledged, setDisclaimerAcknowledged] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const applyProfile = useCallback(() => {
    const response = currentProfile.profile;
    if (response) {
      const name = splitFullName(response.fullName);
      setProfile({
        lastName: name.lastName,
        firstName: name.firstName,
      });
      return;
    }

    setProfile(EMPTY_PROFILE);
  }, [currentProfile.profile]);

  useEffect(() => {
    if (!currentProfile.loading) {
      applyProfile();
    }
  }, [applyProfile, currentProfile.loading]);

  const requiresDisclaimer = useMemo(() => {
    const disclaimerVersion = currentProfile.disclaimer?.version;
    if (!disclaimerVersion) {
      return true;
    }

    return (
      !currentProfile.profile?.disclaimerAccepted ||
      currentProfile.profile.disclaimerVersion !== disclaimerVersion
    );
  }, [currentProfile.disclaimer?.version, currentProfile.profile]);

  useEffect(() => {
    setDisclaimerAcknowledged(!requiresDisclaimer);
  }, [requiresDisclaimer]);

  const completion = useMemo(() => {
    const filled = [profile.lastName, profile.firstName].filter((value) => value.trim()).length;
    return Math.round((filled / 2) * 100);
  }, [profile]);

  const nameIsValid = useMemo(
    () => NAME_PART_REGEX.test(profile.lastName.trim()) && NAME_PART_REGEX.test(profile.firstName.trim()),
    [profile.firstName, profile.lastName],
  );

  const updateField = (field: keyof ProfileFormState, value: string) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
    setSaveError(null);
    setSuccess(null);
  };

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSuccess(null);

    try {
      if (!nameIsValid) {
        setSaveError('Укажите фамилию и имя без цифр и служебных символов. Можно использовать буквы, дефис и апостроф.');
        return false;
      }

      if (requiresDisclaimer && !disclaimerAcknowledged) {
        setSaveError('Перед сохранением профиля нажмите «Ознакомлен» в информационном блоке.');
        return false;
      }

      const wasExisting = currentProfile.hasProfile;
      await currentProfile.saveProfile({
        fullName: buildFullName(profile),
        ...(requiresDisclaimer ? { disclaimerAccepted: true } : {}),
      });
      setSuccess(wasExisting ? 'Профиль обновлён. Данные будут подставляться в новые регистрации.' : 'Профиль создан. Теперь регистрация будет быстрее.');
      return true;
    } catch (requestError: unknown) {
      setSaveError(requestError instanceof Error ? requestError.message : 'Не удалось сохранить профиль');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async () => {
    setSaving(true);
    setSaveError(null);
    setSuccess(null);

    try {
      await currentProfile.deactivateProfile();
      setProfile(EMPTY_PROFILE);
      setDisclaimerAcknowledged(false);
      setSuccess('Профиль деактивирован. Активные записи, напоминания и лист ожидания отменены.');
      return true;
    } catch (requestError: unknown) {
      setSaveError(requestError instanceof Error ? requestError.message : 'Не удалось деактивировать профиль');
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    profile,
    savedProfile: currentProfile.profile,
    disclaimer: currentProfile.disclaimer,
    disclaimerLoading: currentProfile.disclaimerLoading,
    disclaimerAcknowledged,
    requiresDisclaimer,
    hasProfile: currentProfile.hasProfile,
    loading: currentProfile.loading,
    saving,
    error: currentProfile.error,
    saveError,
    success,
    completion,
    nameIsValid,
    updateField,
    setDisclaimerAcknowledged,
    submit,
    deactivate,
    reload: currentProfile.reloadProfile,
  };
};
