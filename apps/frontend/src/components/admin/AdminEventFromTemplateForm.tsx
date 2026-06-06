import { FormEvent, useState } from 'react';
import { Button, FormItem, Input, Select, Text, Textarea } from '@vkontakte/vkui';
import { adminApi } from '../../api/admin.api';
import { AdminFormTemplateDto } from '../../api/contracts';

type AdminEventFromTemplateFormProps = {
  templates: AdminFormTemplateDto[];
  onDone: (eventId: string) => void;
  onError: (message: string) => void;
};

export const AdminEventFromTemplateForm = ({ templates, onDone, onError }: AdminEventFromTemplateFormProps) => {
  const [templateId, setTemplateId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [location, setLocation] = useState('');
  const [capacity, setCapacity] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const created = await adminApi.createEventFromTemplate({
        templateId,
        title: title.trim(),
        description: description.trim() || undefined,
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
        location: location.trim() || undefined,
        capacity: capacity ? Number(capacity) : undefined,
        status: 'PUBLISHED',
        formStatus: 'PUBLISHED',
      });
      onDone(created.eventId);
    } catch (requestError: unknown) {
      onError(requestError instanceof Error ? requestError.message : 'Не удалось создать мероприятие по шаблону');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="admin-form-grid">
      <FormItem top="Шаблон формы">
        <Select
          value={templateId}
          options={[
            { label: 'Выберите шаблон', value: '' },
            ...templates.map((template) => ({ label: `${template.name} v${template.version}`, value: template.id })),
          ]}
          onChange={(event) => setTemplateId(event.target.value)}
        />
      </FormItem>
      <FormItem top="Название мероприятия">
        <Input value={title} onChange={(event) => setTitle(event.target.value)} required />
      </FormItem>
      <FormItem top="Описание">
        <Textarea value={description} onChange={(event) => setDescription(event.target.value)} />
      </FormItem>
      <div className="admin-form-columns">
        <FormItem top="Начало">
          <Input type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} required />
        </FormItem>
        <FormItem top="Окончание">
          <Input type="datetime-local" value={endAt} onChange={(event) => setEndAt(event.target.value)} required />
        </FormItem>
      </div>
      <div className="admin-form-columns">
        <FormItem top="Место">
          <Input value={location} onChange={(event) => setLocation(event.target.value)} />
        </FormItem>
        <FormItem top="Вместимость">
          <Input type="number" min={1} value={capacity} onChange={(event) => setCapacity(event.target.value)} placeholder="Без ограничения" />
        </FormItem>
      </div>
      <Text className="muted-text">Мероприятие и форма будут опубликованы сразу. Это удобно для демонстрации и типовых событий.</Text>
      <Button type="submit" loading={saving} disabled={!templateId || !title.trim() || !startAt || !endAt}>
        Создать мероприятие по шаблону
      </Button>
    </form>
  );
};
