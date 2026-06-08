import { FormEvent, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Div, FormItem, Group, Input, Text, Title } from '@vkontakte/vkui';
import { useAdminAuth } from '../app/providers/AdminAuthProvider';
import { PageHero, StateBlock, StatusBadge, InfoRow } from '../components/common/Ui';
import { useAppSnackbar } from '../hooks/useAppSnackbar';
import { useProfileAutofill } from '../hooks/useProfileAutofill';
import { useRegisterRefresh } from '../hooks/useRegisterRefresh';
import { formatDateTime } from '../utils/format';

const getInitials = (firstName?: string, lastName?: string) => {
  const first = firstName?.trim().charAt(0) ?? '';
  const last = lastName?.trim().charAt(0) ?? '';
  return `${last}${first}`.trim().toUpperCase() || 'ST';
};

const openDocument = (url?: string) => {
  if (!url) {
    return;
  }

  window.open(new URL(url, window.location.origin).toString(), '_blank', 'noopener,noreferrer');
};

export const ProfileAutofillPage = () => {
  const navigate = useNavigate();
  const { snackbar, showError, showSuccess } = useAppSnackbar();
  const { isAdmin } = useAdminAuth();
  const profile = useProfileAutofill();
  const refreshProfile = useCallback(async () => {
    await profile.reload();
  }, [profile.reload]);

  useRegisterRefresh(refreshProfile);

  const submit = async (event: FormEvent) => {
    const ok = await profile.submit(event);
    if (ok) {
      showSuccess('Профиль сохранён.');
    } else {
      showError('Не получилось сохранить профиль. Проверьте поля и попробуйте снова.');
    }
  };

  const deactivateProfile = async () => {
    const confirmed = window.confirm(
      'Деактивировать профиль? Активные записи, напоминания и лист ожидания будут отменены. ФИ будет удалено из профиля.',
    );

    if (!confirmed) {
      return;
    }

    const ok = await profile.deactivate();
    if (ok) {
      showSuccess('Профиль деактивирован. Данные профиля больше не используются.');
    } else {
      showError('Не получилось деактивировать профиль. Попробуйте ещё раз.');
    }
  };

  return (
    <Group className="page-section" mode="plain">
      <PageHero
        eyebrow="Личный кабинет"
        title="Профиль автозаполнения"
        subtitle="VK ID определяется автоматически. В профиле студент вводит только фамилию и имя."
        action={<Button mode="secondary" onClick={() => navigate('/consent')}>Согласие на ПД</Button>}
      />

      <StateBlock loading={profile.loading} error={profile.error}>
        <div className="grid-stack">
          <Card mode="shadow" className="profile-card">
            <Div className="grid-stack">
              <div className="profile-identity">
                <div className="profile-avatar" aria-hidden="true">
                  {getInitials(profile.profile.firstName, profile.profile.lastName)}
                </div>
                <div>
                  <Text className="eyebrow">Данные студента</Text>
                  <Title level="3">{profile.hasProfile ? 'Профиль заполнен' : 'Профиль ещё не заполнен'}</Title>
                  <Text className="muted-text">
                    {profile.hasProfile
                      ? 'Данные будут автоматически подставляться в новые регистрации.'
                      : 'Заполните фамилию и имя, чтобы регистрация на мероприятия проходила быстрее.'}
                  </Text>
                </div>
                <StatusBadge tone={profile.completion === 100 ? 'success' : 'warning'}>{profile.completion}%</StatusBadge>
              </div>

              {profile.savedProfile && (
                <div className="profile-summary">
                  <div className="meta-tile"><InfoRow label="ФИ" value={profile.savedProfile.fullName} /></div>
                  <div className="meta-tile"><InfoRow label="Обновлено" value={formatDateTime(profile.savedProfile.updatedAt)} /></div>
                </div>
              )}
            </Div>
          </Card>

          <Card mode="shadow" className="profile-card">
            <Div>
              <form onSubmit={submit} className="admin-form-grid">
                <div className="admin-form-columns">
                  <FormItem top="Фамилия">
                    <Input value={profile.profile.lastName} onChange={(event) => profile.updateField('lastName', event.target.value)} placeholder="Иванов" required />
                  </FormItem>
                  <FormItem top="Имя">
                    <Input value={profile.profile.firstName} onChange={(event) => profile.updateField('firstName', event.target.value)} placeholder="Иван" required />
                  </FormItem>
                </div>

                <Card mode="shadow" className="soft-card">
                  <Div className="grid-stack">
                    <div>
                      <Text className="eyebrow">Информация о данных</Text>
                      <Title level="3">{profile.disclaimer?.title ?? 'Как используются данные'}</Title>
                    </div>
                    <Text className="muted-text" style={{ whiteSpace: 'pre-line' }}>
                      {profile.disclaimer?.text ?? 'Данные используются только для регистрации на мероприятия и организационных уведомлений.'}
                    </Text>
                    <div className="form-action-row">
                      <Button type="button" mode="secondary" onClick={() => openDocument(profile.disclaimer?.privacyPolicyUrl)}>
                        Политика конфиденциальности
                      </Button>
                      <Button type="button" mode="secondary" onClick={() => openDocument(profile.disclaimer?.userAgreementUrl)}>
                        Пользовательское соглашение
                      </Button>
                    </div>
                    {profile.requiresDisclaimer ? (
                      <div className="form-action-row">
                        <Button
                          type="button"
                          mode={profile.disclaimerAcknowledged ? 'primary' : 'secondary'}
                          onClick={() => profile.setDisclaimerAcknowledged(true)}
                        >
                          Ознакомлен
                        </Button>
                        <StatusBadge tone={profile.disclaimerAcknowledged ? 'success' : 'warning'}>
                          {profile.disclaimerAcknowledged ? 'Подтверждено' : 'Нужно подтвердить'}
                        </StatusBadge>
                      </div>
                    ) : (
                      <StatusBadge tone="success">Дисклеймер уже подтверждён</StatusBadge>
                    )}
                  </Div>
                </Card>

                <div className="form-action-row">
                  <Button size="l" type="submit" loading={profile.saving} disabled={profile.requiresDisclaimer && !profile.disclaimerAcknowledged}>
                    {profile.hasProfile ? 'Обновить профиль' : 'Создать профиль'}
                  </Button>
                  <Button type="button" mode="secondary" size="l" onClick={() => navigate('/events')}>
                    К мероприятиям
                  </Button>
                </div>
              </form>
              {(profile.saveError || profile.success) && (
                <div className="profile-feedback-stack" role="status" aria-live="polite">
                  {profile.saveError && (
                    <Text className="status-badge status-badge-danger profile-feedback-message">
                      {profile.saveError}
                    </Text>
                  )}
                  {profile.success && (
                    <Text className="status-badge status-badge-success profile-feedback-message">
                      {profile.success}
                    </Text>
                  )}
                </div>
              )}
            </Div>
          </Card>

          {profile.hasProfile && (
            <Card mode="shadow" className="profile-card danger-zone">
              <Div className="grid-stack">
                <div>
                  <Text className="eyebrow">Управление данными</Text>
                  <Title level="3">Деактивация профиля</Title>
                  <Text className="muted-text">
                    Если профиль больше не нужен, можно деактивировать его. Активные записи, напоминания и лист ожидания будут отменены, а ФИ будет удалено из профиля.
                  </Text>
                </div>
                <Button mode="secondary" appearance="negative" loading={profile.saving} onClick={deactivateProfile}>
                  Деактивировать профиль
                </Button>
              </Div>
            </Card>
          )}

          <div className="admin-entry">
            <button
              type="button"
              className="admin-entry-link"
              onClick={() => navigate(isAdmin ? '/admin' : '/admin-login')}
            >
              {isAdmin ? 'Панель администратора' : 'Вход для администраторов'}
            </button>
          </div>
        </div>
      </StateBlock>
      {snackbar}
    </Group>
  );
};
