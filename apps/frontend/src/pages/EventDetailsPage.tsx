import { useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Div, Group, Text, Title } from '@vkontakte/vkui';
import { EventCard } from '../components/EventCard';
import { InfoRow, PageHero, StateBlock, StatusBadge } from '../components/common/Ui';
import { useCurrentProfile } from '../app/providers/CurrentProfileProvider';
import { useAppSnackbar } from '../hooks/useAppSnackbar';
import { useEventDetails } from '../hooks/useEventDetails';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';
import { useRegisterRefresh } from '../hooks/useRegisterRefresh';
import { useWaitlist } from '../hooks/useWaitlist';
import { formatDateRange, getAvailableSeatsLabel } from '../utils/format';

export const EventDetailsPage = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { snackbar, showError, showSuccess } = useAppSnackbar();
  const { eventCard: payload, loading, error, reload, refresh } = useEventDetails(eventId);
  const waitlist = useWaitlist(eventId);
  const { hasProfile, loading: profileLoading } = useCurrentProfile();
  const event = payload?.event;
  const hasForm = Boolean(payload?.activeForm);
  const isRegistered = Boolean(payload?.myRegistration);
  const availableSeats = waitlist.status?.availableSeats ?? event?.availableSeats;
  const isFull = Boolean(event?.capacity !== null && event?.capacity !== undefined && availableSeats === 0);
  const isStarted = Boolean(event && new Date(event.startAt).getTime() <= Date.now());
  const canRegister = Boolean(event && !isFull && !isRegistered && !isStarted);
  const showProfileHint = canRegister && !profileLoading && !hasProfile;
  const subscription = waitlist.status?.subscription ?? payload?.myWaitlistSubscription ?? null;
  const isWaitlistActive = subscription?.status === 'ACTIVE';
  const isWaitlistNotified = subscription?.status === 'NOTIFIED';
  const refreshDetails = useCallback(async () => {
    await Promise.all([refresh(), waitlist.reload()]);
  }, [refresh, waitlist.reload]);

  useRegisterRefresh(refreshDetails);
  useRealtimeRefresh(refreshDetails, { intervalMs: 30_000 });

  const subscribeToWaitlist = async () => {
    const ok = await waitlist.subscribe();
    if (ok) {
      showSuccess('Вы добавлены в лист ожидания. Если место освободится, статус обновится в приложении.');
      await reload();
      return;
    }
    showError(waitlist.error ?? 'Не удалось добавиться в лист ожидания.');
  };

  const cancelWaitlist = async () => {
    const ok = await waitlist.cancel();
    if (ok) {
      showSuccess('Заявка в листе ожидания отменена.');
      await reload();
      return;
    }
    showError(waitlist.error ?? 'Не удалось отменить заявку ожидания.');
  };

  return (
    <Group className="page-section" mode="plain">
      <PageHero
        eyebrow="Карточка мероприятия"
        title={event?.title ?? 'Мероприятие'}
        subtitle="Здесь видно, что будет происходить, где и когда встречаемся, есть ли места и можно ли записаться сейчас."
        action={<Button mode="secondary" onClick={() => navigate('/events')}>К афише</Button>}
      />

      <StateBlock
        loading={loading}
        error={error}
        isEmpty={!loading && !error && !payload}
        empty={{ title: 'Мероприятие не найдено', text: 'Возможно, оно скрыто или удалено администратором.' }}
      >
        {payload && (
          <div className="grid-stack">
            <EventCard event={{ ...payload.event, availableSeats }} variant="featured" />

            <Card mode="shadow" className="soft-card">
              <Div className="grid-stack">
                <div>
                  <Text className="eyebrow">Перед записью</Text>
                  <Title level="3">Проверьте детали мероприятия</Title>
                  <Text className="muted-text">
                    Если мест достаточно, запись займёт пару шагов: данные профиля, ответы на форму и согласие на обработку персональных данных.
                  </Text>
                </div>

                <div className="meta-grid">
                  <div className="meta-tile">
                    <InfoRow label="Когда" value={formatDateRange(payload.event.startAt, payload.event.endAt)} />
                  </div>
                  <div className="meta-tile">
                    <InfoRow label="Где" value={payload.event.location || 'Место объявят позже'} />
                  </div>
                  <div className="meta-tile">
                    <InfoRow label="Места" value={getAvailableSeatsLabel(payload.event.capacity, payload.event.registeredCount)} />
                  </div>
                  <div className="meta-tile">
                    <InfoRow label="Форма" value={hasForm ? `Версия ${payload.activeForm?.version}` : 'Без дополнительных вопросов'} />
                  </div>
                </div>

                {isRegistered && <StatusBadge tone="success">Вы записаны на это мероприятие</StatusBadge>}
                {!isRegistered && isStarted && <StatusBadge tone="neutral">Регистрация закрыта: мероприятие уже началось</StatusBadge>}
                {!isRegistered && !isStarted && !hasForm && (
                  <StatusBadge tone="neutral">Дополнительная форма не нужна — запись по данным профиля</StatusBadge>
                )}
                {!isRegistered && isFull && !isStarted && !isWaitlistActive && <StatusBadge tone="danger">Свободных мест пока нет</StatusBadge>}
                {isWaitlistActive && <StatusBadge tone="warning">Вы в листе ожидания места</StatusBadge>}
                {isWaitlistNotified && <StatusBadge tone="success">Место появилось — можно попробовать записаться</StatusBadge>}
                {showProfileHint && (
                  <StatusBadge tone="warning">Для записи нужен заполненный профиль: ФИ и Telegram username</StatusBadge>
                )}
                {waitlist.error && <StatusBadge tone="danger">{waitlist.error}</StatusBadge>}
              </Div>
            </Card>

            <div className="sticky-cta">
              {isRegistered ? (
                <Button mode="primary" size="l" stretched onClick={() => navigate('/my-registrations')}>
                  Перейти в «Мои записи»
                </Button>
              ) : isFull && !isStarted ? (
                isWaitlistActive ? (
                  <Button mode="secondary" size="l" stretched loading={waitlist.busy} onClick={cancelWaitlist}>
                    Убрать заявку из листа ожидания
                  </Button>
                ) : (
                  <Button mode="primary" size="l" stretched loading={waitlist.busy || waitlist.loading} onClick={subscribeToWaitlist}>
                    Уведомить, если появится место
                  </Button>
                )
              ) : (
                <Button mode="primary" size="l" stretched disabled={!canRegister} onClick={() => navigate(`/events/${payload.event.id}/register`)}>
                  {isStarted ? 'Регистрация закрыта' : 'Начать запись'}
                </Button>
              )}
              <Button mode="secondary" size="m" stretched onClick={() => navigate('/profile')}>
                {showProfileHint ? 'Заполнить профиль' : 'Проверить профиль автозаполнения'}
              </Button>
            </div>
          </div>
        )}
      </StateBlock>
      {snackbar}
    </Group>
  );
};
