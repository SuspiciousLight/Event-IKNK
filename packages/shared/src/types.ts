export enum Role {
  USER = 'USER',
  ADMIN = 'ADMIN',
}

export type ConsentVersionRef = {
  version: string;
  textHash: string;
  acceptedAt: string;
};

export enum AuditAction {
  ADMIN_LOGIN = 'ADMIN_LOGIN',
  ADMIN_LOGOUT = 'ADMIN_LOGOUT',
  EVENT_CREATED = 'EVENT_CREATED',
  EVENT_UPDATED = 'EVENT_UPDATED',
  EVENT_DELETED = 'EVENT_DELETED',
  FORM_TEMPLATE_CREATED = 'FORM_TEMPLATE_CREATED',
  BULK_NOTIFICATION_SENT = 'BULK_NOTIFICATION_SENT',
}

export type ApiErrorDto = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

export type PaginationDto = {
  page: number;
  pageSize: number;
  total: number;
};
