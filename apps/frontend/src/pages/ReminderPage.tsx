import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Div, Group, Text } from '@vkontakte/vkui';
import { ReminderToggle } from '../components/ReminderToggle';
import { PageHero, StateBlock, StatusBadge } from '../components/common/Ui';
import { useAppSnackbar } from '../hooks/useAppSnackbar';
import { useReminder } from '../hooks/useReminder';

export const ReminderPage = () => {
  const navigate = useNavigate();
  const { registrationId } = useParams<{ registrationId: string }>();
  const { snackbar, showError, showSuccess } = useAppSnackbar();
  const reminder = useReminder(registrationId);

  const save = async () => {
    const ok = await reminder.save();
    if (ok) {
      showSuccess(reminder.enabled ? 'Напоминание сохранено.' : 'Напоминание снято.');
      return;
    }
    showError('Не удалось обновить напоминание.');
  };

  return (
    <Group className="page-section" mode="plain">
      <PageHero
        eyebrow="Напоминания"
        title="Не забудьте про мероприятие"
        subtitle="Настройте in-app напоминание. Оно привязано к вашей записи и снимается при отмене регистрации."
        action={<Button mode="secondary" onClick={() => navigate('/my-registrations')}>К моим записям</Button>}
      />

      <StateBlock loading={reminder.loading} error={reminder.error}>
        <Card mode="shadow" className="soft-card">
          <Div className="grid-stack">
            <ReminderToggle
              enabled={reminder.enabled}
              remindAt={reminder.remindAt}
              onToggle={reminder.setEnabled}
              onRemindAtChange={reminder.setRemindAt}
              disabled={reminder.saving}
            />
            <div className="inline-actions">
              <Button loading={reminder.saving} onClick={save}>Сохранить</Button>
              <Button mode="secondary" onClick={() => navigate('/my-registrations')}>Назад</Button>
            </div>
            {reminder.success && <StatusBadge tone="success">{reminder.success}</StatusBadge>}
            <Text className="muted-text">Критичные проверки доступа выполняет backend: пользователь может управлять только своими напоминаниями.</Text>
          </Div>
        </Card>
      </StateBlock>
      {snackbar}
    </Group>
  );
};
