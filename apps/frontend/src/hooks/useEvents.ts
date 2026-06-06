import { useCallback, useEffect, useState } from 'react';
import { EventSummaryDto } from '../api/contracts';
import { eventsApi } from '../api/events.api';

export const useEvents = () => {
  const [events, setEvents] = useState<EventSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await eventsApi.list({ page: 1, pageSize: 30 });
      setEvents(response.items);
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : 'Не удалось загрузить мероприятия');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { events, loading, error, reload: load };
};
