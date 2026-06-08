import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Div, Group, Text, Title } from '@vkontakte/vkui';
import { ConsentBlock } from '../components/ConsentBlock';
import { StepForm } from '../components/StepForm';
import { InfoRow, PageHero, StateBlock, StatusBadge } from '../components/common/Ui';
import { useAppSnackbar } from '../hooks/useAppSnackbar';
import { useRegisterRefresh } from '../hooks/useRegisterRefresh';
import { useRegistrationWizard } from '../hooks/useRegistrationWizard';
import { formatDateRange, formatDateTime } from '../utils/format';

export const RegistrationWizardPage = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { snackbar, showError, showSuccess } = useAppSnackbar();
  const wizard = useRegistrationWizard(eventId);

  useRegisterRefresh(wizard.reload);

  const finishRegistration = async () => {
    const ok = await wizard.submitRegistration();
    if (ok) {
      showSuccess('Запись создана.');
    } else {
      showError('Проверьте форму и согласие.');
    }
  };

  const event = wizard.eventCard?.event;

  return (
    <Group className="page-section" mode="plain">
      <PageHero
        eyebrow="Регистрация"
        title={event?.title ?? 'Запись на мероприятие'}
        subtitle="Сценарий состоит из нескольких шагов: данные профиля, ответы на форму и обязательное согласие на обработку ПД."
        action={<Button mode="secondary" onClick={() => navigate(event ? `/events/${event.id}` : '/events')}>Назад</Button>}
      />

      <StateBlock loading={wizard.loading} error={wizard.error}>
        {wizard.phase === 'success' && wizard.createdRegistration && (
          <Card mode="shadow" className="soft-card">
            <Div className="success-screen">
              <div className="success-mark" aria-hidden="true">OK</div>
              <StatusBadge tone="success">Запись создана</StatusBadge>
              <Title level="2">Вы записаны</Title>
              <Text className="muted-text">
                Регистрация создана {formatDateTime(wizard.createdRegistration.registeredAt)}. Теперь можно поставить напоминание или открыть список своих записей.
              </Text>
              <div className="profile-summary">
                <div className="meta-tile">
                  <InfoRow label="ФИ" value={wizard.createdRegistration.profileUsed.fullName} />
                </div>
              </div>
              <Text className="muted-text">
                Факт согласия сохранён: версия {wizard.createdRegistration.consent.version}. Сырые ответы и ПД не попадают в клиентские логи.
              </Text>
              <div className="form-action-row">
                <Button onClick={() => navigate(`/reminder/${wizard.createdRegistration?.id}`)}>
                  Поставить напоминание
                </Button>
                <Button mode="secondary" onClick={() => navigate('/my-registrations')}>
                  Мои записи
                </Button>
              </div>
            </Div>
          </Card>
        )}

        {wizard.phase !== 'success' && wizard.eventCard && wizard.alreadyRegistered && (
          <Card mode="shadow" className="soft-card">
            <Div className="grid-stack">
              <StatusBadge tone="success">Вы уже записаны</StatusBadge>
              <Title level="3">Повторная запись не нужна</Title>
              <Text className="muted-text">Управлять записью и напоминанием можно в разделе «Мои записи».</Text>
              <div className="form-action-row">
                <Button onClick={() => navigate('/my-registrations')}>Мои записи</Button>
                <Button mode="secondary" onClick={() => navigate('/events')}>К афише</Button>
              </div>
            </Div>
          </Card>
        )}

        {wizard.phase !== 'success' && wizard.eventCard && !wizard.alreadyRegistered && wizard.registrationClosed && (
          <Card mode="shadow" className="soft-card">
            <Div className="grid-stack">
              <StatusBadge tone="neutral">Регистрация закрыта</StatusBadge>
              <Title level="3">Мероприятие уже началось</Title>
              <Text className="muted-text">Запись на это мероприятие больше недоступна. Посмотрите другие события в афише.</Text>
              <Button mode="secondary" onClick={() => navigate('/events')}>К афише</Button>
            </Div>
          </Card>
        )}

        {wizard.phase === 'form' && wizard.eventCard?.activeForm && !wizard.alreadyRegistered && !wizard.registrationClosed && (
          <div className="grid-stack">
            {event && (
              <Card mode="shadow" className="soft-card">
                <Div className="meta-grid">
                  <div className="meta-tile"><InfoRow label="Когда" value={formatDateRange(event.startAt, event.endAt)} /></div>
                  <div className="meta-tile"><InfoRow label="Где" value={event.location || 'Место объявят позже'} /></div>
                  <div className="meta-tile"><InfoRow label="Форма" value={`Версия ${wizard.eventCard.activeForm.version}`} /></div>
                </Div>
              </Card>
            )}

            {wizard.profileError ? (
              <Card mode="shadow" className="soft-card">
                <Div className="grid-stack">
                  <StatusBadge tone="warning">Нужен профиль</StatusBadge>
                  <Title level="3">Заполните профиль студента</Title>
                  <Text className="muted-text">{wizard.profileError}</Text>
                  <Button onClick={() => navigate('/profile')}>Заполнить профиль</Button>
                </Div>
              </Card>
            ) : (
              <StepForm
                questions={wizard.questions}
                initialAnswers={wizard.initialAnswers}
                submitLabel="Перейти к согласию"
                submitting={wizard.submitting}
                submitError={wizard.submitError}
                onSubmit={wizard.completeForm}
              />
            )}
          </div>
        )}

        {wizard.phase === 'consent' && wizard.eventCard && !wizard.alreadyRegistered && !wizard.registrationClosed && wizard.profileError && (
          <Card mode="shadow" className="soft-card">
            <Div className="grid-stack">
              <StatusBadge tone="warning">Нужен профиль</StatusBadge>
              <Title level="3">Заполните профиль студента</Title>
              <Text className="muted-text">{wizard.profileError}</Text>
              <Button onClick={() => navigate('/profile')}>Заполнить профиль</Button>
            </Div>
          </Card>
        )}

        {wizard.phase === 'consent' && wizard.eventCard && !wizard.alreadyRegistered && !wizard.registrationClosed && !wizard.profileError && (
          <Card mode="shadow" className="soft-card">
            <Div className="grid-stack">
              <div>
                <Text className="eyebrow">Финальный шаг</Text>
                <Title level="3">Подтвердите согласие</Title>
                <Text className="muted-text">
                  {wizard.eventCard.activeForm
                    ? 'Без согласия запись не создаётся. Мы используем данные только для регистрации на выбранное мероприятие.'
                    : 'Для этого мероприятия дополнительных вопросов нет. Мы используем только данные из профиля и фиксируем согласие на обработку ПД.'}
                </Text>
              </div>

              {!wizard.eventCard.activeForm && wizard.profile && (
                <div className="profile-summary">
                  <div className="meta-tile"><InfoRow label="ФИ" value={wizard.profile.fullName} /></div>
                </div>
              )}

              <ConsentBlock
                accepted={wizard.consentAccepted}
                onToggle={wizard.setConsentAccepted}
                consentVersion={wizard.consentVersion}
                consentText={wizard.consentText}
              />
              {wizard.submitError && <StatusBadge tone="danger">{wizard.submitError}</StatusBadge>}
              <div className="form-action-row">
                {wizard.eventCard.activeForm ? (
                  <Button mode="secondary" onClick={wizard.backToForm} disabled={wizard.submitting}>
                    Назад к форме
                  </Button>
                ) : (
                  <Button mode="secondary" onClick={() => navigate(`/events/${wizard.eventCard?.event.id}`)} disabled={wizard.submitting}>
                    К мероприятию
                  </Button>
                )}
                <Button mode="primary" loading={wizard.submitting} disabled={!wizard.consentAccepted} onClick={finishRegistration}>
                  Завершить регистрацию
                </Button>
              </div>
            </Div>
          </Card>
        )}
      </StateBlock>
      {snackbar}
    </Group>
  );
};
