import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Div, FormItem, Group, Input, Text, Title } from '@vkontakte/vkui';
import { RegistrationListItemDto } from '../api/contracts';
import { InfoRow, PageHero, StateBlock, StatusBadge } from '../components/common/Ui';
import { useAppSnackbar } from '../hooks/useAppSnackbar';
import { MyRegistrationsScope, useMyRegistrations } from '../hooks/useMyRegistrations';
import { formatDateRange, formatDateTime, formatStatus } from '../utils/format';

const RegistrationCard = ({
  item,
  busy,
  reason,
  onReasonChange,
  onCancel,
  onReminder,
}: {
  item: RegistrationListItemDto;
  busy: boolean;
  reason: string;
  onReasonChange: (value: string) => void;
  onCancel: () => void;
  onReminder: () => void;
}) => {
  const isActive = item.status === 'ACTIVE';
  const isEventFinished = Boolean(item.isEventFinished);
  const isEventArchived = item.event?.status === 'ARCHIVED';
  const isManageable = isActive && !isEventFinished && !isEventArchived;
  const badgeTone: 'success' | 'danger' | 'neutral' = isManageable ? 'success' : item.status === 'CANCELED' ? 'danger' : 'neutral';
  const badgeText = item.status === 'CANCELED'
    ? formatStatus(item.status)
    : isEventFinished
      ? 'Мероприятие завершено'
      : isEventArchived
        ? 'В архиве'
        : formatStatus(item.status);

  return (
    <Card mode="shadow" className="registration-card">
      <Div className="registration-card-body">
        <div className="event-card-top">
          <div>
            <Text className="eyebrow">Запись</Text>
            <Title level="3">{item.event?.title ?? 'Мероприятие'}</Title>
          </div>
          <StatusBadge tone={badgeTone}>{badgeText}</StatusBadge>
        </div>

        <div className="meta-grid">
          <div className="meta-tile">
            <InfoRow
              label="Дата мероприятия"
              value={item.event ? formatDateRange(item.event.startAt, item.event.endAt) : formatDateTime(item.registeredAt)}
            />
          </div>
          <div className="meta-tile">
            <InfoRow label="Место" value={item.event?.location || 'Будет объявлено позже'} />
          </div>
          <div className="meta-tile">
            <InfoRow label="Дата записи" value={formatDateTime(item.registeredAt)} />
          </div>
          <div className="meta-tile">
            <InfoRow
              label="Напоминание"
              value={item.activeReminder ? formatDateTime(item.activeReminder.remindAt) : 'Не установлено'}
            />
          </div>
        </div>

        {isManageable ? (
          <div className="cancel-box">
            <FormItem top="Причина отмены, если хотите указать">
              <Input value={reason} onChange={(event) => onReasonChange(event.target.value)} placeholder="Например: не смогу прийти" />
            </FormItem>
            <div className="inline-actions">
              <Button mode="secondary" onClick={onReminder}>Напоминание</Button>
              <Button mode="secondary" loading={busy} onClick={onCancel}>Отменить запись</Button>
            </div>
          </div>
        ) : (
          <Text className="muted-text">
            {item.status === 'CANCELED'
              ? `Запись отменена ${item.canceledAt ? formatDateTime(item.canceledAt) : ''}. ${item.cancelReason ? `Причина: ${item.cancelReason}` : ''}`
              : 'Это событие больше неактивно, поэтому управление записью и напоминанием скрыто.'}
          </Text>
        )}
      </Div>
    </Card>
  );
};

export const MyRegistrationsPage = () => {
  const navigate = useNavigate();
  const { snackbar, showError, showSuccess } = useAppSnackbar();
  const [scope, setScope] = useState<MyRegistrationsScope>('active');
  const { items, loading, error, busyId, cancel } = useMyRegistrations(scope);
  const [cancelReasonById, setCancelReasonById] = useState<Record<string, string>>({});
  const isArchive = scope === 'archive';

  const cancelRegistration = async (registrationId: string, eventTitle?: string) => {
    const confirmed = window.confirm(
      `Отменить запись на «${eventTitle ?? 'мероприятие'}»? Повторно записаться можно будет заново.`,
    );
    if (!confirmed) {
      return;
    }

    const ok = await cancel(registrationId, cancelReasonById[registrationId]);
    if (ok) {
      showSuccess('Запись отменена. Напоминание, если оно было, тоже снято.');
      return;
    }
    showError('Не удалось отменить запись.');
  };

  return (
    <Group className="page-section" mode="plain">
      <PageHero
        eyebrow="Личный раздел"
        title="Мои записи"
        subtitle="Здесь только актуальные записи. Прошедшие и отмененные события лежат в архиве."
        action={<Button mode="secondary" onClick={() => navigate('/events')}>Найти мероприятие</Button>}
      />

      <Card mode="shadow" className="soft-card">
        <Div className="registrations-toolbar">
          <div className="scope-tabs" role="tablist" aria-label="Фильтр записей">
            <Button
              mode={scope === 'active' ? 'primary' : 'secondary'}
              size="m"
              onClick={() => setScope('active')}
            >
              Актуальные
            </Button>
            <Button
              mode={scope === 'archive' ? 'primary' : 'secondary'}
              size="m"
              onClick={() => setScope('archive')}
            >
              Архив
            </Button>
          </div>
          <Text className="muted-text">
            {isArchive
              ? 'Здесь хранятся отмененные записи и мероприятия, которые уже завершились.'
              : 'Здесь только записи, по которым ещё можно прийти на мероприятие или поставить напоминание.'}
          </Text>
        </Div>
      </Card>

      <StateBlock
        loading={loading}
        error={error}
        isEmpty={!loading && !error && items.length === 0}
        empty={{
          title: isArchive ? 'Архив пока пуст' : 'Актуальных записей пока нет',
          text: isArchive
            ? 'Когда мероприятие завершится или запись будет отменена, она появится здесь.'
            : 'Выберите мероприятие в афише и пройдите короткую форму регистрации.',
          actionLabel: isArchive ? 'Показать актуальные' : 'Перейти к афише',
          onAction: isArchive ? () => setScope('active') : () => navigate('/events'),
        }}
      >
        <div className="grid-stack">
          {items.map((item) => (
            <RegistrationCard
              key={item.id}
              item={item}
              busy={busyId === item.id}
              reason={cancelReasonById[item.id] ?? ''}
              onReasonChange={(value) => setCancelReasonById((prev) => ({ ...prev, [item.id]: value }))}
              onCancel={() => cancelRegistration(item.id, item.event?.title)}
              onReminder={() => navigate(`/reminder/${item.id}`)}
            />
          ))}
        </div>
      </StateBlock>
      {snackbar}
    </Group>
  );
};
