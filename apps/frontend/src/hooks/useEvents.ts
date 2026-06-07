import { useCallback, useEffect, useState } from 'react';
import { EventSummaryDto } from '../api/contracts';
import { eventsApi } from '../api/events.api';

type LoadOptions = {
  silent?: boolean;
};

export const useEvents = () => {
  const [events, setEvents] = useState<EventSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (options: LoadOptions = {}) => {
    if (!options.silent) {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await eventsApi.list({ page: 1, pageSize: 30 });
      setEvents(response.items);
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : 'Не удалось загрузить мероприятия');
    } finally {
      if (!options.silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(() => load({ silent: true }), [load]);

  return { events, loading, error, reload: load, refresh };
};
