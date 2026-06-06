import { useState } from 'react';
import { Button, Card, Checkbox, Div, FormItem, Input, Text, Textarea, Title } from '@vkontakte/vkui';
import { adminApi } from '../../api/admin.api';
import { NotificationCampaignDto } from '../../api/contracts';
import { StatusBadge } from '../common/Ui';

type AdminCampaignPanelProps = {
  eventId: string;
  onError: (message: string) => void;
};

export const AdminCampaignPanel = ({ eventId, onError }: AdminCampaignPanelProps) => {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<NotificationCampaignDto | null>(null);

  const createCampaign = async () => {
    if (!eventId || !confirmed) {
      onError('Выберите мероприятие и подтвердите запуск рассылки.');
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const created = await adminApi.createCampaign(eventId, {
        title: title.trim(),
        message: message.trim(),
        status: 'QUEUED',
      });
      setResult(created);
      setConfirmed(false);
    } catch (requestError: unknown) {
      onError(requestError instanceof Error ? requestError.message : 'Не удалось запустить рассылку');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card mode="shadow" className="admin-card">
      <Div className="admin-form-grid">
        <div>
          <Text className="eyebrow">Уведомления</Text>
          <Title level="3">Массовая рассылка участникам</Title>
          <Text className="muted-text">Сообщение получат только активные участники выбранного мероприятия. Отменившие запись исключаются на backend.</Text>
        </div>
        <FormItem top="Тема">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Напоминание о мероприятии" />
        </FormItem>
        <FormItem top="Сообщение">
          <Textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Текст сообщения для участников" />
        </FormItem>
        <FormItem>
          <Checkbox checked={confirmed} onChange={(event) => setConfirmed(event.currentTarget.checked)}>
            Подтверждаю запуск рассылки по активным участникам выбранного мероприятия
          </Checkbox>
        </FormItem>
        <Button loading={loading} disabled={!eventId || !title.trim() || !message.trim() || !confirmed} onClick={createCampaign}>
          Запустить рассылку
        </Button>
        {result && <StatusBadge tone="success">Кампания создана. Получателей: {result.recipientsCount}</StatusBadge>}
      </Div>
    </Card>
  );
};
