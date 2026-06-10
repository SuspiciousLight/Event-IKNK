import { describe, expect, it } from 'vitest';
import { AuditAction, Role } from './types';

describe('shared public contracts', () => {
  it('keeps role values stable for backend/frontend RBAC checks', () => {
    expect(Role.USER).toBe('USER');
    expect(Role.ADMIN).toBe('ADMIN');
    expect(Object.values(Role)).toEqual(['USER', 'ADMIN']);
  });

  it('keeps audit action values stable for audit log filters and reports', () => {
    expect(AuditAction.ADMIN_LOGIN).toBe('ADMIN_LOGIN');
    expect(AuditAction.EVENT_CREATED).toBe('EVENT_CREATED');
    expect(AuditAction.EVENT_DELETED).toBe('EVENT_DELETED');
    expect(AuditAction.BULK_NOTIFICATION_SENT).toBe('BULK_NOTIFICATION_SENT');
  });
});
