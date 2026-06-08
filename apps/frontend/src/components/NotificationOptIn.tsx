import { useMemo, useState } from 'react';
import { Button, ButtonGroup, Card, Div, Text, Title } from '@vkontakte/vkui';
import { requestVkNotificationsPermission } from '../vk/bridge';

const STORAGE_KEY = 'event-app-notifications-tip-state';
type StoredNotificationTipState = 'dismissed' | 'denied';

const readStoredState = (): StoredNotificationTipState | null => {
  try {
    const value = sessionStorage.getItem(STORAGE_KEY);
    return value === 'dismissed' || value === 'denied' ? value : null;
  } catch {
    return null;
  }
};

const rememberState = (value: StoredNotificationTipState) => {
  try {
    sessionStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Non-critical UI state only. If storage is unavailable, just show the tip again.
  }
};

export const NotificationOptIn = () => {
  const isVkContext = useMemo(() => window.location.search.includes('vk_app_id=') || !import.meta.env.PROD, []);
  const [storedState, setStoredState] = useState<StoredNotificationTipState | null>(readStoredState);
  const [status, setStatus] = useState<'idle' | 'requesting' | 'allowed' | 'denied'>('idle');

  if (!isVkContext || storedState) {
    return null;
  }

  const close = (nextState: StoredNotificationTipState = 'dismissed') => {
    rememberState(nextState);
    setStoredState(nextState);
  };

  const allowNotifications = async () => {
    setStatus('requesting');
    const allowed = await requestVkNotificationsPermission();

    if (allowed) {
      setStatus('allowed');
      window.setTimeout(() => close('dismissed'), 900);
      return;
    }

    rememberState('denied');
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
              Уведомления не включены. Их можно разрешить позже в настройках VK или при создании напоминания.
            </Text>
          )}
        </div>
        <ButtonGroup mode="horizontal" className="notification-opt-in-actions">
          {status !== 'denied' ? (
            <>
              <Button size="s" mode="primary" loading={status === 'requesting'} onClick={allowNotifications}>
                Включить
              </Button>
              <Button size="s" mode="secondary" onClick={() => close('dismissed')}>
                Позже
              </Button>
            </>
          ) : (
            <Button size="s" mode="secondary" onClick={() => close('denied')}>
              Понятно
            </Button>
          )}
        </ButtonGroup>
      </Div>
    </Card>
  );
};
