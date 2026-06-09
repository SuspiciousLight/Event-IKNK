import { Div, Text, Title } from '@vkontakte/vkui';
import { AuditLogDto } from '../../api/contracts';
import { AsyncBoundary } from '../common/AsyncBoundary';
import { formatDateTime } from '../../utils/format';

type AdminAuditLogListProps = {
  logs: AuditLogDto[];
  loading: boolean;
  error?: string | null;
};

export const AdminAuditLogList = ({ logs, loading, error }: AdminAuditLogListProps) => (
  <Div className="grid-stack">
    <div>
      <Text className="eyebrow">Журнал</Text>
      <Title level="3">Журнал административных действий</Title>
      <Text className="muted-text">Здесь отображаются последние действия администратора: создание событий, экспорт и рассылки.</Text>
    </div>
    <AsyncBoundary
      loading={loading}
      error={error}
      isEmpty={!loading && !error && logs.length === 0}
      emptyTitle="Журнал пока пуст"
      emptyText="Когда администратор создаст мероприятие, экспортирует Excel или запустит рассылку, событие появится здесь."
    >
      <div className="admin-table">
        {logs.map((log) => (
          <div className="admin-table-row" key={log.id}>
            <Text weight="2">{log.action}</Text>
            <Text className="muted-text">{log.targetType} {log.targetId ?? ''}</Text>
            <Text className="muted-text">{formatDateTime(log.createdAt)}</Text>
          </div>
        ))}
      </div>
    </AsyncBoundary>
  </Div>
);
