import { useCallback, useEffect, useState } from 'react';
import { EventCardResponseDto } from '../api/contracts';
import { eventsApi } from '../api/events.api';

type LoadOptions = {
  silent?: boolean;
};

export const useEventDetails = (eventId?: string) => {
  const [eventCard, setEventCard] = useState<EventCardResponseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (options: LoadOptions = {}) => {
    if (!eventId) {
      setEventCard(null);
      setError('Некорректный идентификатор мероприятия');
      setLoading(false);
      return;
    }

    if (!options.silent) {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await eventsApi.getById(eventId);
      setEventCard(response);
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : 'Не удалось загрузить мероприятие');
    } finally {
      if (!options.silent) {
        setLoading(false);
      }
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(() => load({ silent: true }), [load]);

  return { eventCard, loading, error, reload: load, refresh };
};
