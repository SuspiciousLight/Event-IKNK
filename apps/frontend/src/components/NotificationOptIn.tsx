import { useMemo, useState } from 'react';
import { Button, ButtonGroup, Card, Div, Text, Title } from '@vkontakte/vkui';
import { requestVkNotificationsPermission } from '../vk/bridge';

const SESSION_KEY = 'event-app-notifications-tip-dismissed';

const readDismissed = () => {
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1';
  } catch {
    return false;
  }
};

const rememberDismissed = () => {
  try {
    sessionStorage.setItem(SESSION_KEY, '1');
  } catch {
    // Non-critical UI state only. If storage is unavailable, just show the tip again.
  }
};

export const NotificationOptIn = () => {
  const isVkContext = useMemo(() => window.location.search.includes('vk_app_id=') || !import.meta.env.PROD, []);
  const [dismissed, setDismissed] = useState(readDismissed);
  const [status, setStatus] = useState<'idle' | 'requesting' | 'allowed' | 'denied'>('idle');

  if (!isVkContext || dismissed) {
    return null;
  }

  const close = () => {
    rememberDismissed();
    setDismissed(true);
  };

  const allowNotifications = async () => {
    setStatus('requesting');
    const allowed = await requestVkNotificationsPermission();

    if (allowed) {
      setStatus('allowed');
      window.setTimeout(close, 900);
      return;
    }

    setStatus('denied');
  };

  return (
    <Card mode="shadow" className="notification-opt-in">
      <Div className="notification-opt-in-body">
        <div className="notification-opt-in-icon" aria-hidden="true">
          !
        </div>
        <div className="notification-opt-in-copy">
          <Text className="eyebrow">Напоминания</Text>
          <Title level="3">Включите уведомления</Title>
          <Text className="muted-text">
            Мы напомним о ваших записях и важных изменениях, чтобы вы не пропустили мероприятие.
          </Text>
          {status === 'allowed' && <Text className="status-badge status-badge-success">Уведомления включены.</Text>}
          {status === 'denied' && (
            <Text className="status-badge status-badge-warning">
              Сейчас уведомления не включены. Их можно разрешить позже в настройках VK или при создании напоминания.
            </Text>
          )}
        </div>
        <ButtonGroup mode="horizontal" className="notification-opt-in-actions">
          <Button size="s" mode="primary" loading={status === 'requesting'} onClick={allowNotifications}>
            Включить
          </Button>
          <Button size="s" mode="secondary" onClick={close}>
            Позже
          </Button>
        </ButtonGroup>
      </Div>
    </Card>
  );
};
