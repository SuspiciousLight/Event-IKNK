import { FormItem, Input, Switch, Text, Title } from '@vkontakte/vkui';

type ReminderToggleProps = {
  enabled: boolean;
  remindAt: string;
  onToggle: (enabled: boolean) => void;
  onRemindAtChange: (value: string) => void;
  disabled?: boolean;
};

export const ReminderToggle = ({
  enabled,
  remindAt,
  onToggle,
  onRemindAtChange,
  disabled = false,
}: ReminderToggleProps) => (
  <div className="consent-box">
    <div className="reminder-toggle-line">
      <div>
        <Title level="3">Напоминание</Title>
        <Text className="muted-text">Mini app сохранит напоминание внутри приложения. Внешние каналы не используются.</Text>
      </div>
      <Switch checked={enabled} disabled={disabled} onChange={(event) => onToggle(event.currentTarget.checked)} />
    </div>
    {enabled && (
      <FormItem top="Когда напомнить">
        <Input type="datetime-local" value={remindAt} disabled={disabled} onChange={(event) => onRemindAtChange(event.target.value)} />
      </FormItem>
    )}
  </div>
);
