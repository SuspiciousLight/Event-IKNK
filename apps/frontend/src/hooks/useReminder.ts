import { useCallback, useEffect, useState } from 'react';
import { ReminderDto } from '../api/contracts';
import { remindersApi } from '../api/reminders.api';
import { requestVkNotificationsPermission } from '../vk/bridge';

const toDateTimeLocal = (date: Date) => date.toISOString().slice(0, 16);

const defaultReminderDate = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 30);
  return toDateTimeLocal(now);
};

export const useReminder = (registrationId?: string) => {
  const [reminder, setReminder] = useState<ReminderDto | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [remindAt, setRemindAt] = useState(defaultReminderDate());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!registrationId) {
      setError('Некорректный идентификатор регистрации');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await remindersApi.getForRegistration(registrationId);
      setReminder(response);
      setEnabled(!!response);
      setRemindAt(response ? toDateTimeLocal(new Date(response.remindAt)) : defaultReminderDate());
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : 'Не удалось загрузить напоминание');
    } finally {
      setLoading(false);
    }
  }, [registrationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!registrationId) {
      setError('Некорректный идентификатор регистрации');
      return false;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      if (!enabled) {
        if (reminder) {
          await remindersApi.cancelForRegistration(registrationId);
          setReminder(null);
        }
        setSuccess('Напоминание снято.');
        return true;
      }

      const notificationsAllowed = await requestVkNotificationsPermission();
      if (!notificationsAllowed) {
        setError('Разрешите уведомления VK, чтобы напоминание могло прийти на телефон.');
        return false;
      }

      const response = await remindersApi.setForRegistration(registrationId, new Date(remindAt).toISOString());
      setReminder(response);
      setSuccess('Напоминание сохранено.');
      return true;
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : 'Не удалось сохранить напоминание');
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    reminder,
    enabled,
    remindAt,
    loading,
    saving,
    error,
    success,
    setEnabled,
    setRemindAt,
    save,
    reload: load,
  };
};
