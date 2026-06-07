import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Group, Input, Text } from '@vkontakte/vkui';
import { EventCard } from '../components/EventCard';
import { StateBlock, PageHero, EmptyState } from '../components/common/Ui';
import { useEvents } from '../hooks/useEvents';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';
import { useRegisterRefresh } from '../hooks/useRegisterRefresh';

export const EventsListPage = () => {
  const navigate = useNavigate();
  const { events, loading, error, reload, refresh } = useEvents();
  const [query, setQuery] = useState('');

  useRegisterRefresh(refresh);
  useRealtimeRefresh(refresh, { intervalMs: 45_000 });

  const filteredEvents = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return events;
    }

    return events.filter((event) => {
      const haystack = [event.title, event.description, event.location].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(normalized);
    });
  }, [events, query]);

  return (
    <Group className="page-section" mode="plain">
      <div className="catalog-header">
        <PageHero
          eyebrow="Афиша"
          title="Найдите интересующее вас событие"
          subtitle="Откройте карточку, проверьте дату и места, заполните форму и подтвердите согласие на обработку персональных данных."
        />

        <div className="search-card">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск по названию, месту или описанию"
            aria-label="Поиск мероприятий"
          />
          <Text className="muted-text" style={{ marginTop: 8 }}>
            Доступно мероприятий: {events.length}. В фильтре: {filteredEvents.length}.
          </Text>
        </div>
      </div>

      <StateBlock
        loading={loading}
        error={error}
        isEmpty={!loading && !error && events.length === 0}
        empty={{
          title: 'Мероприятий пока нет',
          text: 'Как только администратор опубликует мероприятие, оно появится здесь красивой карточкой.',
          actionLabel: 'Обновить',
          onAction: () => void reload(),
        }}
      >
        {filteredEvents.length === 0 ? (
          <EmptyState
            title="Ничего не найдено"
            text="Попробуйте убрать часть запроса или открыть полный список мероприятий."
            actionLabel="Сбросить поиск"
            onAction={() => setQuery('')}
          />
        ) : (
          <div className="card-grid-modern">
            {filteredEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onOpen={(eventId) => navigate(`/events/${eventId}`)}
                onRegister={(eventId) => navigate(`/events/${eventId}/register`)}
                onOpenMyRegistration={() => navigate('/my-registrations')}
              />
            ))}
          </div>
        )}
      </StateBlock>
    </Group>
  );
};
