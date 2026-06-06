import { Button, Card, Div, Text, Title } from '@vkontakte/vkui';
import { EventSummaryDto } from '../api/contracts';
import { formatDateRange, getAvailableSeatsLabel } from '../utils/format';
import { InfoRow, StatusBadge } from './common/Ui';

type EventCardProps = {
  event: EventSummaryDto;
  variant?: 'compact' | 'featured';
  onOpen?: (eventId: string) => void;
  onRegister?: (eventId: string) => void;
  onOpenMyRegistration?: () => void;
};

export const EventCard = ({ event, variant = 'compact', onOpen, onRegister, onOpenMyRegistration }: EventCardProps) => {
  const isFull = event.capacity !== null && event.capacity !== undefined && event.availableSeats === 0;
  const isRegistered = Boolean(event.myRegistrationId);
  const now = Date.now();
  const isPast = new Date(event.endAt).getTime() < now;
  const isStarted = new Date(event.startAt).getTime() <= now;
  const seatsLabel = getAvailableSeatsLabel(event.capacity, event.registeredCount);
  const description = event.description || 'Описание появится позже. Следите за обновлениями в карточке мероприятия.';

  const coverBadge = isRegistered
    ? { tone: 'success' as const, label: 'Вы записаны' }
    : isPast
      ? { tone: 'neutral' as const, label: 'Завершено' }
      : isFull
        ? { tone: 'danger' as const, label: 'Нет мест' }
        : { tone: 'success' as const, label: 'Идёт запись' };

  return (
    <Card mode="shadow" className="event-card-modern">
      <div className="event-cover">
        <div className="event-cover-title">{event.title}</div>
        <div className="event-cover-badge">
          <StatusBadge tone={coverBadge.tone}>{coverBadge.label}</StatusBadge>
        </div>
      </div>

      <Div className="event-card-body">
        <div className="event-card-top">
          <div>
            <Text className="eyebrow">Мероприятие</Text>
            <Title level={variant === 'featured' ? '2' : '3'} weight="2">
              {variant === 'featured' ? 'Подробности события' : 'Что нужно знать'}
            </Title>
          </div>
          <StatusBadge tone="accent">{seatsLabel}</StatusBadge>
        </div>

        <Text className="event-description">{description}</Text>

        <div className="meta-grid">
          <div className="meta-tile">
            <InfoRow label="Дата и время" value={formatDateRange(event.startAt, event.endAt)} />
          </div>
          <div className="meta-tile">
            <InfoRow label="Место" value={event.location || 'Будет объявлено позже'} />
          </div>
          <div className="meta-tile">
            <InfoRow label="Свободные места" value={seatsLabel} />
          </div>
        </div>

        <div className="event-card-actions">
          {onOpen && (
            <Button mode="secondary" size="m" onClick={() => onOpen(event.id)}>
              Подробнее
            </Button>
          )}
          {isRegistered && onOpenMyRegistration ? (
            <Button mode="secondary" size="m" onClick={onOpenMyRegistration}>
              Вы записаны →
            </Button>
          ) : (
            onRegister && (
              <Button
                mode="primary"
                size="m"
                disabled={isStarted}
                onClick={() => (isFull && onOpen ? onOpen(event.id) : onRegister(event.id))}
              >
                {isStarted ? 'Запись закрыта' : isFull ? 'Лист ожидания' : 'Записаться'}
              </Button>
            )
          )}
        </div>
      </Div>
    </Card>
  );
};
