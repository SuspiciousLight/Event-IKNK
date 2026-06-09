import { useCallback, useEffect, useState } from 'react';
import { useAdminAuth } from '../app/providers/AdminAuthProvider';
import { adminApi } from '../api/admin.api';
import { HttpError } from '../api/client';
import {
  AdminEventDto,
  AdminFormTemplateDto,
  AdminRegistrationRowDto,
  AuditLogDto,
  PaginationDto,
} from '../api/contracts';

type LoadOptions = {
  silent?: boolean;
};

export const useAdminPanel = () => {
  const { admin, logoutAdmin } = useAdminAuth();
  const [events, setEvents] = useState<AdminEventDto[]>([]);
  const [templates, setTemplates] = useState<AdminFormTemplateDto[]>([]);
  const [logs, setLogs] = useState<AuditLogDto[]>([]);
  const [registrations, setRegistrations] = useState<AdminRegistrationRowDto[]>([]);
  const [registrationsMeta, setRegistrationsMeta] = useState<PaginationDto | null>(null);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [registrationsPage, setRegistrationsPage] = useState(1);
  const [registrationsSearch, setRegistrationsSearch] = useState('');
  const [includeCanceled, setIncludeCanceled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [registrationsLoading, setRegistrationsLoading] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [registrationsError, setRegistrationsError] = useState<string | null>(null);
  const [logsError, setLogsError] = useState<string | null>(null);

  const handleAdminRequestError = useCallback(async (requestError: unknown, fallback: string) => {
    if (requestError instanceof HttpError && (requestError.status === 401 || requestError.status === 403)) {
      await logoutAdmin();
      return 'Сессия администратора истекла. Войдите снова.';
    }

    return requestError instanceof Error ? requestError.message : fallback;
  }, [logoutAdmin]);

  const loadBaseData = useCallback(async (options: LoadOptions = {}) => {
    if (!admin) {
      setEvents([]);
      setTemplates([]);
      setLogs([]);
      setRegistrations([]);
      setRegistrationsMeta(null);
      setSelectedEventId('');
      setLoading(false);
      return;
    }

    if (!options.silent) {
      setLoading(true);
    }
    setError(null);
    try {
      const [eventsResponse, templatesResponse] = await Promise.all([
        adminApi.listEvents({ page: 1, pageSize: 50 }),
        adminApi.listFormTemplates({ page: 1, pageSize: 50 }),
      ]);

      setEvents(eventsResponse.items);
      setTemplates(templatesResponse.items);
      setSelectedEventId((prev) => prev || eventsResponse.items[0]?.id || '');
    } catch (requestError: unknown) {
      setError(await handleAdminRequestError(requestError, 'Не удалось загрузить админ-панель'));
    } finally {
      if (!options.silent) {
        setLoading(false);
      }
    }
  }, [admin, handleAdminRequestError]);

  const loadRegistrations = useCallback(async (page = registrationsPage, options: LoadOptions = {}) => {
    if (!selectedEventId) {
      setRegistrations([]);
      setRegistrationsMeta(null);
      return;
    }

    if (!options.silent) {
      setRegistrationsLoading(true);
    }
    setRegistrationsError(null);
    try {
      const response = await adminApi.getEventRegistrations(selectedEventId, {
        page,
        pageSize: 20,
        search: registrationsSearch,
        status: includeCanceled ? 'CANCELED' : 'ACTIVE',
        sortBy: 'registeredAt',
        sortOrder: 'asc',
      });
      setRegistrations(response.items);
      setRegistrationsMeta(response.meta);
      setRegistrationsPage(page);
    } catch (requestError: unknown) {
      setRegistrationsError(await handleAdminRequestError(requestError, 'Не удалось загрузить участников'));
    } finally {
      if (!options.silent) {
        setRegistrationsLoading(false);
      }
    }
  }, [handleAdminRequestError, includeCanceled, registrationsPage, registrationsSearch, selectedEventId]);

  const loadLogs = useCallback(async (options: LoadOptions = {}) => {
    if (!options.silent) {
      setLogsLoading(true);
    }
    setLogsError(null);
    try {
      const response = await adminApi.listAuditLogs({ page: 1, pageSize: 10 });
      setLogs(response.items);
    } catch (requestError: unknown) {
      setLogsError(await handleAdminRequestError(requestError, 'Не удалось загрузить журнал действий'));
    } finally {
      if (!options.silent) {
        setLogsLoading(false);
      }
    }
  }, [handleAdminRequestError]);

  const updateRegistrationStatus = useCallback(async (registrationId: string, status: 'ACTIVE' | 'CANCELED') => {
    if (!selectedEventId) {
      setRegistrationsError('Выберите мероприятие.');
      return false;
    }

    setStatusBusyId(registrationId);
    setRegistrationsError(null);
    try {
      await adminApi.updateRegistrationStatus(selectedEventId, registrationId, status);
      await Promise.all([
        loadRegistrations(registrationsPage, { silent: true }),
        loadBaseData({ silent: true }),
        loadLogs({ silent: true }),
      ]);
      return true;
    } catch (requestError: unknown) {
      setRegistrationsError(await handleAdminRequestError(requestError, 'Не удалось изменить статус участника'));
      return false;
    } finally {
      setStatusBusyId(null);
    }
  }, [
    handleAdminRequestError,
    loadBaseData,
    loadLogs,
    loadRegistrations,
    registrationsPage,
    selectedEventId,
  ]);

  const deleteEvent = useCallback(async (eventId: string) => {
    await adminApi.deleteEvent(eventId);

    const [eventsResponse, templatesResponse] = await Promise.all([
      adminApi.listEvents({ page: 1, pageSize: 50 }),
      adminApi.listFormTemplates({ page: 1, pageSize: 50 }),
    ]);

    setEvents(eventsResponse.items);
    setTemplates(templatesResponse.items);

    const eventStillExists = eventsResponse.items.some((event) => event.id === selectedEventId);
    const nextSelectedId = eventStillExists ? selectedEventId : eventsResponse.items[0]?.id || '';
    setSelectedEventId(nextSelectedId);

    if (!nextSelectedId || selectedEventId === eventId) {
      setRegistrations([]);
      setRegistrationsMeta(null);
      setRegistrationsPage(1);
    }
  }, [selectedEventId]);

  const refresh = useCallback(async () => {
    if (!admin) {
      return;
    }

    await Promise.all([
      loadBaseData({ silent: true }),
      selectedEventId ? loadRegistrations(registrationsPage, { silent: true }) : Promise.resolve(),
      loadLogs({ silent: true }),
    ]);
  }, [admin, loadBaseData, loadLogs, loadRegistrations, registrationsPage, selectedEventId]);

  useEffect(() => {
    void loadBaseData();
  }, [loadBaseData]);

  useEffect(() => {
    if (admin) {
      void loadLogs();
    }
  }, [admin, loadLogs]);

  useEffect(() => {
    if (admin && selectedEventId) {
      void loadRegistrations(1);
    }
  }, [admin, selectedEventId, includeCanceled, loadRegistrations]);

  return {
    admin,
    events,
    templates,
    logs,
    selectedEventId,
    registrations,
    registrationsMeta,
    registrationsPage,
    registrationsSearch,
    includeCanceled,
    loading,
    registrationsLoading,
    logsLoading,
    statusBusyId,
    error,
    registrationsError,
    logsError,
    setSelectedEventId,
    setRegistrationsSearch,
    setIncludeCanceled,
    loadBaseData,
    loadRegistrations,
    loadLogs,
    deleteEvent,
    updateRegistrationStatus,
    refresh,
  };
};
