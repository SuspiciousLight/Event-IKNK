import { useCallback, useEffect, useState } from 'react';
import { EventCardResponseDto } from '../api/contracts';
import { eventsApi } from '../api/events.api';

export const useEventDetails = (eventId?: string) => {
  const [eventCard, setEventCard] = useState<EventCardResponseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!eventId) {
      setEventCard(null);
      setError('Некорректный идентификатор мероприятия');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await eventsApi.getById(eventId);
      setEventCard(response);
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : 'Не удалось загрузить мероприятие');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { eventCard, loading, error, reload: load };
};
