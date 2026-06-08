import { FormEvent, useMemo, useState } from 'react';
import { Button, FormItem, Input, Select, Text, Textarea } from '@vkontakte/vkui';
import { adminApi } from '../../api/admin.api';
import { AdminEventDto } from '../../api/contracts';

const toDateTimeLocal = (date: Date) => date.toISOString().slice(0, 16);

const defaultStart = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(12, 0, 0, 0);
  return toDateTimeLocal(date);
};

const defaultEnd = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(14, 0, 0, 0);
  return toDateTimeLocal(date);
};

type AdminEventFormProps = {
  onCreated: (event: AdminEventDto) => void;
  onError: (message: string) => void;
};

const toIso = (value: string) => new Date(value).toISOString();

export const AdminEventForm = ({ onCreated, onError }: AdminEventFormProps) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startAt, setStartAt] = useState(defaultStart());
  const [endAt, setEndAt] = useState(defaultEnd());
  const [location, setLocation] = useState('');
  const [capacity, setCapacity] = useState('');
  const [status, setStatus] = useState<'DRAFT' | 'PUBLISHED'>('PUBLISHED');
  const [saving, setSaving] = useState(false);

  const isValidRange = useMemo(() => new Date(endAt) > new Date(startAt), [endAt, startAt]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!isValidRange) {
      onError('Дата окончания должна быть позже даты начала.');
      return;
    }

    setSaving(true);
    try {
      const created = await adminApi.createEvent({
        title: title.trim(),
        description: description.trim() || undefined,
        startAt: toIso(startAt),
        endAt: toIso(endAt),
        location: location.trim() || undefined,
        capacity: capacity ? Number(capacity) : undefined,
        status,
      });
      setTitle('');
      setDescription('');
      setLocation('');
      setCapacity('');
      onCreated(created);
    } catch (requestError: unknown) {
      onError(requestError instanceof Error ? requestError.message : 'Не удалось создать мероприятие');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="admin-form-grid">
      <FormItem top="Название">
        <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Например: День карьеры" required />
      </FormItem>
      <FormItem top="Описание">
        <Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Что будет на мероприятии и кому оно подходит" />
      </FormItem>
      <div className="admin-form-columns">
        <FormItem top="Начало">
          <Input type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} required />
        </FormItem>
        <FormItem top="Окончание" bottom={!isValidRange ? 'Окончание должно быть позже начала' : undefined}>
          <Input type="datetime-local" value={endAt} onChange={(event) => setEndAt(event.target.value)} required />
        </FormItem>
      </div>
      <div className="admin-form-columns">
        <FormItem top="Место">
          <Input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Аудитория, корпус или онлайн" />
        </FormItem>
        <FormItem top="Вместимость" bottom="Оставьте поле пустым, если лимит участников не ограничен.">
          <Input type="number" min={1} value={capacity} onChange={(event) => setCapacity(event.target.value)} placeholder="Без ограничения" />
        </FormItem>
      </div>
      <FormItem top="Статус">
        <Select
          value={status}
          options={[
            { label: 'Черновик', value: 'DRAFT' },
            { label: 'Опубликовано', value: 'PUBLISHED' },
          ]}
          onChange={(event) => setStatus(event.target.value as 'DRAFT' | 'PUBLISHED')}
        />
      </FormItem>
      <Text className="muted-text">Опубликованное мероприятие сразу появится у студентов. Форму регистрации можно добавить следующим шагом.</Text>
      <Button type="submit" loading={saving} disabled={!title.trim() || !startAt || !endAt || !isValidRange}>
        Создать мероприятие
      </Button>
    </form>
  );
};
