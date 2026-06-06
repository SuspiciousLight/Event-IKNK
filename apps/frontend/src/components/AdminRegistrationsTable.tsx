import { Button, Div, Text, Title } from '@vkontakte/vkui';
import { AdminRegistrationRowDto, PaginationDto } from '../api/contracts';
import { AsyncBoundary } from './common/AsyncBoundary';
import { StatusBadge } from './common/Ui';
import { formatDateTime, formatStatus } from '../utils/format';

type AdminRegistrationsTableProps = {
  rows: AdminRegistrationRowDto[];
  meta?: PaginationDto;
  loading: boolean;
  error?: string | null;
  onPrevPage?: () => void;
  onNextPage?: () => void;
};

export const AdminRegistrationsTable = ({
  rows,
  meta,
  loading,
  error,
  onPrevPage,
  onNextPage,
}: AdminRegistrationsTableProps) => (
  <Div className="grid-stack">
    <div className="event-card-top">
      <div>
        <Text className="eyebrow">Участники</Text>
        <Title level="3">Зарегистрированные студенты</Title>
      </div>
      {meta && <StatusBadge tone="accent">Всего: {meta.total}</StatusBadge>}
    </div>
    <AsyncBoundary
      loading={loading}
      error={error}
      isEmpty={!loading && !error && rows.length === 0}
      emptyTitle="Участников пока нет"
      emptyText="Когда студенты начнут записываться, они появятся в этом списке."
    >
      <div className="admin-table">
        {rows.map((row) => (
          <div className="admin-table-row" key={row.id}>
            <div className="admin-registration-row-top">
              <Text weight="2" className="admin-registration-name">{row.userProfile.fullName}</Text>
              <StatusBadge tone={row.status === 'ACTIVE' ? 'success' : 'danger'}>{formatStatus(row.status)}</StatusBadge>
            </div>
            <Text className="muted-text">
              VK ID: {row.userProfile.vkUserId ?? 'не получен'} · Telegram: {row.userProfile.telegramUsername ?? 'не указан'}
            </Text>
            <Text className="muted-text">Записан: {formatDateTime(row.registeredAt)}</Text>
            {row.canceledAt && <Text className="muted-text">Отменено: {formatDateTime(row.canceledAt)}</Text>}
          </div>
        ))}
      </div>
      {meta && (
        <div className="admin-pagination">
          <Button mode="secondary" size="s" onClick={onPrevPage} disabled={!onPrevPage || meta.page <= 1}>Назад</Button>
          <Text>Страница {meta.page} из {Math.max(1, Math.ceil(meta.total / meta.pageSize))}</Text>
          <Button mode="secondary" size="s" onClick={onNextPage} disabled={!onNextPage || meta.page * meta.pageSize >= meta.total}>Далее</Button>
        </div>
      )}
    </AsyncBoundary>
  </Div>
);
