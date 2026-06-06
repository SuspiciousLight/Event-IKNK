import { useCallback, useEffect, useState } from 'react';
import { WaitlistStatusDto } from '../api/contracts';
import { eventsApi } from '../api/events.api';

export const useWaitlist = (eventId?: string) => {
  const [status, setStatus] = useState<WaitlistStatusDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!eventId) {
      setStatus(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await eventsApi.getWaitlistStatus(eventId);
      setStatus(response);
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : 'Не удалось загрузить статус листа ожидания');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  const subscribe = async () => {
    if (!eventId) {
      return false;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await eventsApi.subscribeToWaitlist(eventId);
      setStatus(response);
      return true;
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : 'Не удалось подписаться на уведомление');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!eventId) {
      return false;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await eventsApi.cancelWaitlist(eventId);
      setStatus(response);
      return true;
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : 'Не удалось отменить подписку');
      return false;
    } finally {
      setBusy(false);
    }
  };

  return {
    status,
    loading,
    busy,
    error,
    reload: load,
    subscribe,
    cancel,
  };
};
