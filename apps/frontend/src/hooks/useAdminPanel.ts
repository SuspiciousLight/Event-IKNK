import { useCallback, useEffect, useState } from 'react';
import { useAdminAuth } from '../app/providers/AdminAuthProvider';
import { adminApi } from '../api/admin.api';
import {
  AdminEventDto,
  AdminFormTemplateDto,
  AdminRegistrationRowDto,
  AuditLogDto,
  PaginationDto,
} from '../api/contracts';

export const useAdminPanel = () => {
  const { admin } = useAdminAuth();
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
  const [error, setError] = useState<string | null>(null);
  const [registrationsError, setRegistrationsError] = useState<string | null>(null);
  const [logsError, setLogsError] = useState<string | null>(null);

  const loadBaseData = useCallback(async () => {
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

    setLoading(true);
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
      setError(requestError instanceof Error ? requestError.message : 'Не удалось загрузить админ-панель');
    } finally {
      setLoading(false);
    }
  }, [admin]);

  const loadRegistrations = useCallback(async (page = registrationsPage) => {
    if (!selectedEventId) {
      setRegistrations([]);
      setRegistrationsMeta(null);
      return;
    }

    setRegistrationsLoading(true);
    setRegistrationsError(null);
    try {
      const response = await adminApi.getEventRegistrations(selectedEventId, {
        page,
        pageSize: 20,
        search: registrationsSearch,
        includeCanceled,
        sortBy: 'registeredAt',
        sortOrder: 'desc',
      });
      setRegistrations(response.items);
      setRegistrationsMeta(response.meta);
      setRegistrationsPage(page);
    } catch (requestError: unknown) {
      setRegistrationsError(requestError instanceof Error ? requestError.message : 'Не удалось загрузить участников');
    } finally {
      setRegistrationsLoading(false);
    }
  }, [includeCanceled, registrationsPage, registrationsSearch, selectedEventId]);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    setLogsError(null);
    try {
      const response = await adminApi.listAuditLogs({ page: 1, pageSize: 10 });
      setLogs(response.items);
    } catch (requestError: unknown) {
      setLogsError(requestError instanceof Error ? requestError.message : 'Не удалось загрузить журнал действий');
    } finally {
      setLogsLoading(false);
    }
  }, []);

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
    error,
    registrationsError,
    logsError,
    setSelectedEventId,
    setRegistrationsSearch,
    setIncludeCanceled,
    loadBaseData,
    loadRegistrations,
    loadLogs,
  };
};
