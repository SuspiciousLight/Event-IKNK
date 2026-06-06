import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  EventCardResponseDto,
  FormQuestionDto,
  RegistrationAnswerInputDto,
  RegistrationCreatedDto,
  UserProfileDto,
} from '../api/contracts';
import { useCurrentProfile } from '../app/providers/CurrentProfileProvider';
import { consentsApi } from '../api/consents.api';
import { eventsApi } from '../api/events.api';
import { registrationsApi } from '../api/registrations.api';
import { FormAnswersMap, FormAnswerValue } from '../types/domain';

type WizardPhase = 'form' | 'consent' | 'success';

const isNameQuestion = (question: FormQuestionDto) => {
  const source = `${question.fieldKey} ${question.label}`.toLowerCase();
  return (
    source.includes('fio') ||
    source.includes('full') ||
    source.includes('name') ||
    source.includes('фио')
  );
};

const isTelegramQuestion = (question: FormQuestionDto) => {
  const source = `${question.fieldKey} ${question.label}`.toLowerCase();
  return source.includes('telegram') || source.includes('tg') || source.includes('телеграм');
};

const profileValueForQuestion = (
  profile: UserProfileDto | null,
  question: FormQuestionDto,
): FormAnswerValue => {
  if (!profile) {
    return undefined;
  }

  if (question.questionType === 'TEXT' && isNameQuestion(question)) {
    return profile.fullName;
  }

  if (question.questionType === 'TEXT' && isTelegramQuestion(question)) {
    return profile.telegramUsername ?? undefined;
  }

  return undefined;
};

const buildInitialAnswers = (
  profile: UserProfileDto | null,
  questions: FormQuestionDto[],
): FormAnswersMap =>
  questions.reduce<FormAnswersMap>((acc, question) => {
    const value = profileValueForQuestion(profile, question);
    if (value) {
      acc[question.fieldKey] = value;
    }
    return acc;
  }, {});

const mapAnswers = (answers: FormAnswersMap): RegistrationAnswerInputDto[] =>
  Object.entries(answers)
    .filter(([, value]) => {
      if (Array.isArray(value)) {
        return value.length > 0;
      }
      return typeof value === 'string' && value.trim().length > 0;
    })
    .map(([questionKey, value]) => {
      if (Array.isArray(value)) {
        return { questionKey, answerJson: { values: value } };
      }

      return { questionKey, answerText: typeof value === 'string' ? value.trim() : '' };
    });

export const useRegistrationWizard = (eventId?: string) => {
  const currentProfile = useCurrentProfile();
  const [eventCard, setEventCard] = useState<EventCardResponseDto | null>(null);
  const [consentDocument, setConsentDocument] = useState<{
    version: string;
    textHash: string;
    text: string;
  } | null>(null);
  const [phase, setPhase] = useState<WizardPhase>('form');
  const [draftAnswers, setDraftAnswers] = useState<FormAnswersMap>({});
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [createdRegistration, setCreatedRegistration] = useState<RegistrationCreatedDto | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const questions = useMemo(() => eventCard?.activeForm?.questions ?? [], [eventCard]);
  const profile = currentProfile.profile;
  const initialAnswers = useMemo(
    () => buildInitialAnswers(profile, questions),
    [profile, questions],
  );
  const isEventFull = eventCard?.event.capacity !== null && eventCard?.event.availableSeats === 0;
  const alreadyRegistered = Boolean(eventCard?.myRegistration);
  const registrationClosed = Boolean(
    eventCard && new Date(eventCard.event.startAt).getTime() <= Date.now(),
  );

  const profileError = useMemo(() => {
    if (currentProfile.loading) {
      return null;
    }

    if (currentProfile.error) {
      return currentProfile.error;
    }

    if (!currentProfile.profile) {
      return 'Сначала заполните личный кабинет: ФИ и Telegram username нужны для регистрации и автозаполнения формы.';
    }

    return null;
  }, [currentProfile.error, currentProfile.loading, currentProfile.profile]);

  const load = useCallback(async () => {
    if (!eventId) {
      setError('Некорректный идентификатор мероприятия');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const [eventResult, consentResult] = await Promise.allSettled([
      eventsApi.getById(eventId),
      consentsApi.getCurrent(),
    ]);

    if (eventResult.status === 'fulfilled') {
      setEventCard(eventResult.value);
      // No form attached → skip the questions step and go straight to consent.
      if (!eventResult.value.activeForm) {
        setPhase('consent');
      }
    } else {
      setError(
        eventResult.reason instanceof Error
          ? eventResult.reason.message
          : 'Не удалось загрузить форму регистрации',
      );
    }

    if (consentResult.status === 'fulfilled') {
      setConsentDocument(consentResult.value);
    } else {
      setConsentDocument(null);
      setError(
        consentResult.reason instanceof Error
          ? consentResult.reason.message
          : 'Не удалось загрузить текст согласия',
      );
    }

    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  const completeForm = async (answers: FormAnswersMap) => {
    setDraftAnswers(answers);
    setSubmitError(null);
    setPhase('consent');
  };

  const backToForm = () => {
    setSubmitError(null);
    setPhase('form');
  };

  const submitRegistration = async () => {
    if (!eventId || !eventCard) {
      setSubmitError('Мероприятие недоступно. Попробуйте позже.');
      return false;
    }

    if (isEventFull) {
      setSubmitError('Свободных мест больше нет. Запись на мероприятие закрыта.');
      return false;
    }

    if (!profile) {
      setSubmitError('Перед регистрацией заполните личный кабинет.');
      return false;
    }

    if (!consentDocument) {
      setSubmitError('Актуальный текст согласия недоступен. Регистрация временно невозможна.');
      return false;
    }

    if (!consentAccepted) {
      setSubmitError(
        'Перед завершением регистрации нужно принять согласие на обработку персональных данных.',
      );
      return false;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const created = await registrationsApi.create({
        eventId,
        ...(eventCard.activeForm
          ? { registrationFormId: eventCard.activeForm.id, answers: mapAnswers(draftAnswers) }
          : {}),
        consent: {
          accepted: true,
          version: consentDocument.version,
          textHash: consentDocument.textHash,
        },
      });
      setCreatedRegistration(created);
      setPhase('success');
      return true;
    } catch (requestError: unknown) {
      setSubmitError(
        requestError instanceof Error ? requestError.message : 'Не удалось создать запись',
      );
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  return {
    eventCard,
    profile,
    questions,
    phase,
    initialAnswers,
    draftAnswers,
    consentAccepted,
    createdRegistration,
    loading: loading || currentProfile.loading,
    submitting,
    error,
    profileError,
    submitError,
    isEventFull,
    alreadyRegistered,
    registrationClosed,
    consentVersion: consentDocument?.version ?? '',
    consentTextHash: consentDocument?.textHash ?? '',
    consentText: consentDocument?.text ?? '',
    setConsentAccepted,
    completeForm,
    backToForm,
    submitRegistration,
    reload: load,
  };
};
