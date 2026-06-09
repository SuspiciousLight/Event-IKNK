import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Checkbox, Div, FormItem, Group, Input, Select, Text, Title } from '@vkontakte/vkui';
import { useAdminAuth } from '../app/providers/AdminAuthProvider';
import { adminApi } from '../api/admin.api';
import { AdminAuditLogList } from '../components/admin/AdminAuditLogList';
import { AdminCampaignPanel } from '../components/admin/AdminCampaignPanel';
import { AdminEventForm } from '../components/admin/AdminEventForm';
import { AdminEventFromTemplateForm } from '../components/admin/AdminEventFromTemplateForm';
import { AdminFormBuilder } from '../components/admin/AdminFormBuilder';
import { AdminRegistrationsTable } from '../components/AdminRegistrationsTable';
import { PageHero, StateBlock, StatusBadge, InfoRow } from '../components/common/Ui';
import { useAdminPanel } from '../hooks/useAdminPanel';
import { useAppSnackbar } from '../hooks/useAppSnackbar';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';
import { useRegisterRefresh } from '../hooks/useRegisterRefresh';
import { formatDateRange, formatStatus } from '../utils/format';

type AdminTab = 'overview' | 'events' | 'forms' | 'registrations' | 'campaigns' | 'audit';

const TABS: Array<{ id: AdminTab; label: string }> = [
  { id: 'overview', label: 'Обзор' },
  { id: 'events', label: 'Мероприятия' },
  { id: 'forms', label: 'Формы и шаблоны' },
  { id: 'registrations', label: 'Участники' },
  { id: 'campaigns', label: 'Рассылка' },
  { id: 'audit', label: 'Журнал' },
];

export const AdminPanelPage = () => {
  const navigate = useNavigate();
  const panel = useAdminPanel();
  const { logoutAdmin } = useAdminAuth();
  const { snackbar, showError, showSuccess } = useAppSnackbar();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [tabHistory, setTabHistory] = useState<AdminTab[]>([]);
  const isMobileDevice = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

  useRegisterRefresh(panel.refresh, Boolean(panel.admin));
  useRealtimeRefresh(panel.refresh, {
    enabled: Boolean(panel.admin),
    intervalMs: activeTab === 'registrations' ? 20_000 : 45_000,
  });

  const selectedEvent = panel.events.find((event) => event.id === panel.selectedEventId);
  const activeEvents = panel.events.filter((event) => event.status === 'PUBLISHED').length;
  const totalRegistrations = panel.events.reduce((sum, event) => sum + (event._count?.registrations ?? 0), 0);
  const selectedEventRegistrations = selectedEvent?._count?.registrations ?? 0;
  const hasCapacityLimit = selectedEvent?.capacity !== null && selectedEvent?.capacity !== undefined;
  const selectedEventAvailableSeats = hasCapacityLimit
    ? Math.max((selectedEvent?.capacity ?? 0) - selectedEventRegistrations, 0)
    : 'Без лимита';
  const selectedEventLoad = hasCapacityLimit
    ? `${selectedEventRegistrations} из ${selectedEvent?.capacity}`
    : `${selectedEventRegistrations}, лимита нет`;
  const now = new Date();
  const selectedEventLifecycle = selectedEvent
    ? new Date(selectedEvent.endAt) < now
      ? 'Завершено'
      : new Date(selectedEvent.startAt) <= now
        ? 'Идёт сейчас'
        : 'Запланировано'
    : 'Выберите мероприятие';
  const previousTab = tabHistory[tabHistory.length - 1];
  const previousTabLabel = TABS.find((tab) => tab.id === previousTab)?.label;

  const changeAdminTab = (nextTab: AdminTab) => {
    if (nextTab === activeTab) {
      return;
    }

    setTabHistory((prev) => [...prev, activeTab].slice(-8));
    setActiveTab(nextTab);
  };

  const goBackInsideAdmin = () => {
    if (!previousTab) {
      return;
    }

    setActiveTab(previousTab);
    setTabHistory((prev) => prev.slice(0, -1));
  };

  const logout = async () => {
    try {
      await logoutAdmin();
      showSuccess('Вы вышли из админ-панели.');
    } catch (requestError: unknown) {
      showError(requestError instanceof Error ? requestError.message : 'Не удалось выйти');
    } finally {
      navigate('/events', { replace: true });
    }
  };

  const deleteEvent = async (eventId: string, eventTitle: string) => {
    const confirmed = window.confirm(
      `Удалить мероприятие «${eventTitle}»? Оно скроется у студентов и в списке. Регистрации и история сохранятся.`,
    );
    if (!confirmed) {
      return;
    }

    try {
      await panel.deleteEvent(eventId);
      await panel.loadLogs();
      showSuccess('Мероприятие удалено.');
    } catch (requestError: unknown) {
      showError(requestError instanceof Error ? requestError.message : 'Не удалось удалить мероприятие');
    }
  };

  const exportExcel = async () => {
    if (isMobileDevice) {
      showError('В мобильном VK Excel может открыться неправильно. Скачайте файл с компьютера, а на телефоне используйте список участников.');
      return;
    }

    if (!panel.selectedEventId) {
      showError('Выберите мероприятие для выгрузки.');
      return;
    }

    try {
      const blob = await adminApi.exportEventRegistrationsExcel(panel.selectedEventId, panel.includeCanceled);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const safeTitle = (selectedEvent?.title ?? 'event').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
      link.download = `${safeTitle || 'event'}-registrations.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      showSuccess('Excel выгружен.');
      await panel.loadLogs();
    } catch (requestError: unknown) {
      showError(requestError instanceof Error ? requestError.message : 'Не удалось выгрузить Excel');
    }
  };

  const changeRegistrationStatus = async (registrationId: string, status: 'ACTIVE' | 'CANCELED') => {
    const ok = await panel.updateRegistrationStatus(registrationId, status);
    if (ok) {
      showSuccess(status === 'ACTIVE' ? 'Статус изменён: активна.' : 'Статус изменён: отменена.');
    } else {
      showError('Не удалось изменить статус участника.');
    }
  };

  return (
    <Group className="page-section" mode="plain">
      <PageHero
        eyebrow="Админ-панель"
        title="Управление мероприятиями"
        subtitle="Создавайте мероприятия и формы, смотрите участников, выгружайте Excel и запускайте VK-уведомления."
        action={(
          <>
            {previousTab && (
              <Button mode="secondary" onClick={goBackInsideAdmin}>
                Назад{previousTabLabel ? ` к «${previousTabLabel}»` : ''}
              </Button>
            )}
            <Button mode="secondary" onClick={() => navigate('/events')}>Афиша</Button>
          </>
        )}
      />

      <StateBlock loading={panel.loading} error={panel.error}>
        <div className="admin-shell">
          <aside className="admin-sidebar">
            <div className="admin-sidebar-tabs">
              {TABS.map((tab) => (
                <Button
                  key={tab.id}
                  className="admin-sidebar-button"
                  mode={activeTab === tab.id ? 'primary' : 'secondary'}
                  size="s"
                  onClick={() => changeAdminTab(tab.id)}
                >
                  {tab.label}
                </Button>
              ))}
            </div>
            <div className="admin-sidebar-footer">
              <Button mode="secondary" appearance="negative" stretched onClick={logout}>
                Выйти из админки
              </Button>
            </div>
          </aside>

          <div className="admin-main grid-stack">
            <Card mode="shadow" className="admin-card">
              <Div className="grid-stack">
                <div className="event-card-top">
                  <div>
                    <Text className="eyebrow">Выбранное мероприятие</Text>
                    <Title level="3">{selectedEvent?.title ?? 'Мероприятие не выбрано'}</Title>
                  </div>
                  {selectedEvent && (
                    <StatusBadge tone={selectedEvent.status === 'PUBLISHED' ? 'success' : selectedEvent.status === 'ARCHIVED' ? 'neutral' : 'warning'}>
                      {formatStatus(selectedEvent.status ?? '')}
                    </StatusBadge>
                  )}
                </div>
                <Select
                  value={panel.selectedEventId}
                  options={[
                    { label: 'Выберите мероприятие', value: '' },
                    ...panel.events.map((event) => ({ label: event.title, value: event.id })),
                  ]}
                  onChange={(event) => panel.setSelectedEventId(event.target.value)}
                />
                {selectedEvent && (
                  <div className="meta-grid">
                    <div className="meta-tile"><InfoRow label="Дата" value={formatDateRange(selectedEvent.startAt, selectedEvent.endAt)} /></div>
                    <div className="meta-tile"><InfoRow label="Участников" value={selectedEvent._count?.registrations ?? 0} /></div>
                    <div className="meta-tile"><InfoRow label="Форм" value={selectedEvent._count?.forms ?? 0} /></div>
                  </div>
                )}
                {selectedEvent && (selectedEvent._count?.forms ?? 0) === 0 && (
                  <StatusBadge tone="neutral">
                    Форма не добавлена — запись пойдёт по данным профиля. Добавьте форму во вкладке «Формы», если нужны доп. данные.
                  </StatusBadge>
                )}
              </Div>
            </Card>

            {activeTab === 'overview' && (
              <div className="grid-stack">
                <div className="meta-grid admin-overview-global-stats">
                  <Card mode="shadow" className="admin-card"><Div><InfoRow label="Всего мероприятий" value={panel.events.length} /></Div></Card>
                  <Card mode="shadow" className="admin-card"><Div><InfoRow label="Опубликовано" value={activeEvents} /></Div></Card>
                  <Card mode="shadow" className="admin-card"><Div><InfoRow label="Активных записей" value={totalRegistrations} /></Div></Card>
                  <Card mode="shadow" className="admin-card"><Div><InfoRow label="Шаблонов" value={panel.templates.length} /></Div></Card>
                </div>

                <Card mode="shadow" className="admin-card admin-overview-event-stats">
                  <Div className="grid-stack">
                    <div>
                      <Text className="eyebrow">Статистика мероприятия</Text>
                      <Title level="3">{selectedEvent?.title ?? 'Выберите мероприятие выше'}</Title>
                      <Text className="muted-text">
                        Сводка помогает быстро понять, сколько студентов записалось и есть ли свободные места.
                      </Text>
                    </div>
                    <div className="meta-grid">
                      <div className="meta-tile">
                        <InfoRow label="Состояние" value={selectedEventLifecycle} />
                      </div>
                      <div className="meta-tile">
                        <InfoRow label="Дата" value={selectedEvent ? formatDateRange(selectedEvent.startAt, selectedEvent.endAt) : 'Не выбрано'} />
                      </div>
                      <div className="meta-tile">
                        <InfoRow label="Активные участники" value={selectedEventRegistrations} />
                      </div>
                      <div className="meta-tile">
                        <InfoRow label="Заполненность" value={selectedEvent ? selectedEventLoad : 'Не выбрано'} />
                      </div>
                      <div className="meta-tile">
                        <InfoRow label="Свободные места" value={selectedEvent ? selectedEventAvailableSeats : 'Не выбрано'} />
                      </div>
                      <div className="meta-tile">
                        <InfoRow label="Форм регистрации" value={selectedEvent?._count?.forms ?? 0} />
                      </div>
                    </div>
                    {!selectedEvent && (
                      <StatusBadge tone="neutral">Выберите мероприятие в верхнем блоке, чтобы увидеть детальную статистику.</StatusBadge>
                    )}
                  </Div>
                </Card>
              </div>
            )}
            {activeTab === 'events' && (
              <div className="grid-stack">
                <Card mode="shadow" className="admin-card admin-events-list">
                  <Div className="grid-stack">
                    <div>
                      <Text className="eyebrow">Сначала выберите событие</Text>
                      <Title level="3">Список мероприятий</Title>
                      <Text className="muted-text">Откройте мероприятие из списка, чтобы дальше создать форму, посмотреть участников или запустить рассылку.</Text>
                    </div>
                    <div className="admin-table">
                      {panel.events.length === 0 ? (
                        <div className="admin-table-row">
                          <Text weight="2">Мероприятий пока нет</Text>
                          <Text className="muted-text">Создайте первое мероприятие в блоке ниже.</Text>
                        </div>
                      ) : (
                        panel.events.map((event) => (
                          <div
                            className={`admin-event-row ${panel.selectedEventId === event.id ? 'admin-event-row-active' : ''}`}
                            key={event.id}
                          >
                            <button className="admin-event-select" type="button" onClick={() => panel.setSelectedEventId(event.id)}>
                              <div className="event-card-top">
                                <Text weight="2">{event.title}</Text>
                                <StatusBadge tone={event.status === 'PUBLISHED' ? 'success' : event.status === 'ARCHIVED' ? 'neutral' : 'warning'}>
                                  {formatStatus(event.status ?? '')}
                                </StatusBadge>
                              </div>
                              <Text className="muted-text">{formatDateRange(event.startAt, event.endAt)} · участников: {event._count?.registrations ?? 0}</Text>
                              {(event._count?.forms ?? 0) === 0 && (
                                <StatusBadge tone="neutral">Без формы — запись по данным профиля</StatusBadge>
                              )}
                            </button>
                            <div className="form-action-row admin-event-row-actions">
                              <Button mode="secondary" size="s" onClick={() => panel.setSelectedEventId(event.id)}>
                                Выбрать
                              </Button>
                              <Button mode="secondary" appearance="negative" size="s" onClick={() => deleteEvent(event.id, event.title)}>
                                Удалить
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </Div>
                </Card>

                <Card mode="shadow" className="admin-card admin-events-create">
                  <Div className="grid-stack">
                    <div>
                      <Text className="eyebrow">Создание</Text>
                      <Title level="3">Новое мероприятие</Title>
                    </div>
                    <AdminEventForm
                      onCreated={async (event) => {
                        panel.setSelectedEventId(event.id);
                        await panel.loadBaseData();
                        showSuccess('Мероприятие создано. Теперь можно добавить форму.');
                      }}
                      onError={showError}
                    />
                  </Div>
                </Card>

                {panel.templates.length > 0 && (
                  <Card mode="shadow" className="admin-card">
                    <Div className="grid-stack">
                      <div>
                        <Text className="eyebrow">Быстрый сценарий</Text>
                        <Title level="3">Создать мероприятие с готовой формой</Title>
                        <Text className="muted-text">Выберите шаблон, и система сразу создаст мероприятие вместе с опубликованной формой.</Text>
                      </div>
                      <AdminEventFromTemplateForm
                        templates={panel.templates}
                        onDone={async (eventId) => {
                          panel.setSelectedEventId(eventId);
                          await panel.loadBaseData();
                          await panel.loadLogs();
                          showSuccess('Мероприятие создано по шаблону.');
                        }}
                        onError={showError}
                      />
                    </Div>
                  </Card>
                )}
              </div>
            )}

            {activeTab === 'forms' && (
              <div className="grid-stack">
                <Card mode="shadow" className="admin-card">
                  <Div className="grid-stack">
                    <div>
                      <Text className="eyebrow">Формы и шаблоны</Text>
                      <Title level="3">Конструктор вопросов</Title>
                      <Text className="muted-text">
                        Форма привязывается к выбранному мероприятию. Шаблон — это заготовка вопросов, которую можно переиспользовать позже.
                      </Text>
                    </div>
                  </Div>
                </Card>

                <Card mode="shadow" className="admin-card">
                  <Div className="grid-stack">
                    <div>
                      <Text className="eyebrow">Сохранённые шаблоны</Text>
                      <Title level="3">Заготовки вопросов</Title>
                    </div>
                    <div className="admin-table">
                      {panel.templates.length === 0 ? (
                        <div className="admin-table-row">
                          <Text weight="2">Шаблонов пока нет</Text>
                          <Text className="muted-text">Создайте шаблон ниже, если хотите переиспользовать набор вопросов.</Text>
                        </div>
                      ) : (
                        panel.templates.map((template) => (
                          <div className="admin-table-row" key={template.id}>
                            <Text weight="2">{template.name} v{template.version}</Text>
                            <Text className="muted-text">{template.description || 'Без описания'} · вопросов: {template.questions.length}</Text>
                          </div>
                        ))
                      )}
                    </div>
                  </Div>
                </Card>

                <AdminFormBuilder
                  key={`forms-${panel.selectedEventId}-${panel.templates.length}`}
                  selectedEventId={panel.selectedEventId}
                  templates={panel.templates}
                  mode="both"
                  onDone={async () => {
                    await panel.loadBaseData();
                    await panel.loadLogs();
                    showSuccess('Форма или шаблон сохранены.');
                  }}
                  onError={showError}
                />
              </div>
            )}

            {activeTab === 'registrations' && (
              <Card mode="shadow" className="admin-card">
                <Div className="grid-stack">
                  <div className="admin-filter-row">
                    <FormItem top="Поиск">
                      <Input value={panel.registrationsSearch} placeholder="ФИ или VK ID" onChange={(event) => panel.setRegistrationsSearch(event.target.value)} />
                    </FormItem>
                    <Checkbox checked={panel.includeCanceled} onChange={(event) => panel.setIncludeCanceled(event.currentTarget.checked)}>
                      Только отменённые
                    </Checkbox>
                    <Button onClick={() => panel.loadRegistrations(1)}>Применить</Button>
                    <Button mode="secondary" disabled={isMobileDevice} onClick={exportExcel}>
                      {isMobileDevice ? 'Excel на ПК' : 'Excel'}
                    </Button>
                  </div>
                  {isMobileDevice && (
                    <Text className="muted-text">
                      На телефоне участники доступны в списке ниже. Excel лучше скачивать с компьютера, чтобы файл нормально сохранился.
                    </Text>
                  )}
                  <AdminRegistrationsTable
                    rows={panel.registrations}
                    meta={panel.registrationsMeta ?? undefined}
                    loading={panel.registrationsLoading}
                    error={panel.registrationsError}
                    onPrevPage={() => panel.loadRegistrations(Math.max(1, panel.registrationsPage - 1))}
                    onNextPage={() => panel.loadRegistrations(panel.registrationsPage + 1)}
                    onStatusChange={changeRegistrationStatus}
                    statusBusyId={panel.statusBusyId}
                    emptyText={
                      panel.includeCanceled
                        ? 'Отменённых регистраций по выбранному мероприятию нет.'
                        : 'Когда студенты начнут записываться, они появятся в этом списке.'
                    }
                  />
                </Div>
              </Card>
            )}

            {activeTab === 'campaigns' && <AdminCampaignPanel eventId={panel.selectedEventId} onError={showError} />}
            {activeTab === 'audit' && <AdminAuditLogList logs={panel.logs} loading={panel.logsLoading} error={panel.logsError} />}
          </div>
        </div>
      </StateBlock>
      {snackbar}
    </Group>
  );
};
