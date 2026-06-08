export const formatDateTime = (value: string | Date): string => {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return 'Дата уточняется';
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date).replace(',', '');
};

export const formatDateRange = (startAt: string, endAt: string): string => {
  const start = new Date(startAt);
  const end = new Date(endAt);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 'Дата уточняется';
  }

  const sameDay = start.toDateString() === end.toDateString();
  if (sameDay) {
    const day = new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: 'long',
    }).format(start);
    const startTime = new Intl.DateTimeFormat('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(start);
    const endTime = new Intl.DateTimeFormat('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(end);
    return `${day}, ${startTime}-${endTime}`;
  }

  return `${formatDateTime(start)} - ${formatDateTime(end)}`;
};

export const formatStatus = (status: string): string => {
  const statuses: Record<string, string> = {
    ACTIVE: 'Активна',
    CANCELED: 'Отменена',
    DRAFT: 'Черновик',
    PUBLISHED: 'Опубликовано',
    ARCHIVED: 'Архив',
    QUEUED: 'В очереди',
    SENT: 'Отправлена',
    FAILED: 'Ошибка',
    SCHEDULED: 'Запланировано',
  };

  return statuses[status] ?? status;
};

export const getAvailableSeatsLabel = (capacity?: number | null, registeredCount?: number): string => {
  if (!capacity) {
    return 'Количество мест не ограничено';
  }

  const left = Math.max(capacity - (registeredCount ?? 0), 0);
  return left > 0 ? `Осталось мест: ${left} из ${capacity}` : 'Мест больше нет';
};
