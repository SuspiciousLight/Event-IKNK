import { describe, expect, it } from 'vitest';
import { formatDateRange, formatDateTime, formatStatus, getAvailableSeatsLabel } from './format';

describe('frontend format helpers', () => {
  it('formats ISO-like date strings into readable Russian date and time', () => {
    expect(formatDateTime('2026-06-06T22:27:02')).toBe('06.06.2026 22:27');
  });

  it('returns a safe fallback for invalid dates', () => {
    expect(formatDateTime('not-a-date')).toBe('Дата уточняется');
    expect(formatDateRange('not-a-date', '2026-06-06T14:30:00')).toBe('Дата уточняется');
  });

  it('formats same-day event ranges compactly', () => {
    expect(formatDateRange('2026-06-06T12:00:00', '2026-06-06T14:30:00')).toBe('06 июня, 12:00-14:30');
  });

  it('translates known statuses and leaves unknown statuses visible for diagnostics', () => {
    expect(formatStatus('ACTIVE')).toBe('Активна');
    expect(formatStatus('ARCHIVED')).toBe('Архив');
    expect(formatStatus('UNKNOWN_STATUS')).toBe('UNKNOWN_STATUS');
  });

  it('explains event capacity without exposing implementation details', () => {
    expect(getAvailableSeatsLabel(null, 10)).toBe('Количество мест не ограничено');
    expect(getAvailableSeatsLabel(25, 10)).toBe('Осталось мест: 15 из 25');
    expect(getAvailableSeatsLabel(10, 12)).toBe('Мест больше нет');
  });
});
