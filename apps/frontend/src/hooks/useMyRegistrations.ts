import { useCallback, useEffect, useState } from 'react';
import { RegistrationListItemDto } from '../api/contracts';
import { registrationsApi } from '../api/registrations.api';

export type MyRegistrationsScope = 'active' | 'archive';

export const useMyRegistrations = (scope: MyRegistrationsScope) => {
  const [items, setItems] = useState<RegistrationListItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await registrationsApi.listMy({ page: 1, pageSize: 30, scope });
      setItems(response.items);
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : 'Не удалось загрузить ваши записи');
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    void load();
  }, [load]);

  const cancel = async (registrationId: string, reason?: string) => {
    setBusyId(registrationId);
    setError(null);

    try {
      await registrationsApi.cancel(registrationId, reason?.trim() || undefined);
      await load();
      return true;
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : 'Не удалось отменить запись');
      return false;
    } finally {
      setBusyId(null);
    }
  };

  return { items, loading, error, busyId, cancel, reload: load };
};
