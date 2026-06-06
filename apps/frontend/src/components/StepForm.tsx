import { useEffect, useMemo, useState } from 'react';
import { Button, ButtonGroup, Card, Div, Text, Title } from '@vkontakte/vkui';
import { FormQuestionDto } from '../api/contracts';
import { FormAnswersMap } from '../types/domain';
import { QuestionRenderer } from './QuestionRenderer';
import { StatusBadge } from './common/Ui';

type StepFormProps = {
  questions: FormQuestionDto[];
  initialAnswers?: FormAnswersMap;
  submitLabel?: string;
  submitting?: boolean;
  submitError?: string | null;
  onSubmit: (answers: FormAnswersMap) => Promise<void>;
};

const hasValue = (value: string | string[] | undefined): boolean => {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return typeof value === 'string' && value.trim().length > 0;
};

export const StepForm = ({
  questions,
  initialAnswers = {},
  submitLabel = 'Продолжить',
  submitting = false,
  submitError,
  onSubmit,
}: StepFormProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<FormAnswersMap>(initialAnswers);
  const [localError, setLocalError] = useState<string | null>(null);

  const currentQuestion = questions[currentStep];
  const isLastStep = currentStep === questions.length - 1;
  const progress = questions.length ? Math.round(((currentStep + 1) / questions.length) * 100) : 0;

  useEffect(() => {
    setAnswers((prev) => ({ ...initialAnswers, ...prev }));
  }, [initialAnswers]);

  const isCurrentAnswerValid = useMemo(() => {
    if (!currentQuestion) {
      return false;
    }

    if (!currentQuestion.isRequired) {
      return true;
    }

    return hasValue(answers[currentQuestion.fieldKey]);
  }, [answers, currentQuestion]);

  const nextStep = () => {
    if (!isCurrentAnswerValid) {
      setLocalError('Заполните обязательный вопрос, чтобы продолжить.');
      return;
    }

    setLocalError(null);
    setCurrentStep((step) => Math.min(step + 1, questions.length - 1));
  };

  const prevStep = () => {
    setLocalError(null);
    setCurrentStep((step) => Math.max(step - 1, 0));
  };

  const submit = async () => {
    const missingRequired = questions.some((question) => question.isRequired && !hasValue(answers[question.fieldKey]));

    if (missingRequired) {
      setLocalError('Проверьте форму: есть незаполненные обязательные вопросы.');
      return;
    }

    setLocalError(null);
    await onSubmit(answers);
  };

  if (!currentQuestion) {
    return (
      <Card mode="shadow" className="soft-card">
        <Div>
          <Title level="3">Форма пока пустая</Title>
          <Text className="muted-text">Администратор ещё не добавил вопросы для регистрации.</Text>
        </Div>
      </Card>
    );
  }

  return (
    <Card mode="shadow" className="soft-card">
      <Div className="step-shell">
        <div className="step-progress">
          <div className="event-card-top">
            <div>
              <Text className="eyebrow">Шаг {currentStep + 1} из {questions.length}</Text>
              <Title level="3">Ответьте на вопросы формы</Title>
            </div>
            <StatusBadge tone="accent">{progress}%</StatusBadge>
          </div>
          <div className="step-progress-track">
            <div className="step-progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="step-question">
          <QuestionRenderer
            question={currentQuestion}
            value={answers[currentQuestion.fieldKey]}
            onChange={(value) =>
              setAnswers((prev) => ({
                ...prev,
                [currentQuestion.fieldKey]: value,
              }))
            }
          />
        </div>

        {(localError || submitError) && <Text className="status-badge status-badge-danger">{localError || submitError}</Text>}

        <div className="step-actions">
          <ButtonGroup mode="horizontal" stretched>
            <Button mode="secondary" onClick={prevStep} disabled={currentStep === 0 || submitting}>
              Назад
            </Button>
            {!isLastStep ? (
              <Button mode="primary" onClick={nextStep} disabled={submitting}>
                Далее
              </Button>
            ) : (
              <Button mode="primary" onClick={submit} loading={submitting}>
                {submitLabel}
              </Button>
            )}
          </ButtonGroup>
        </div>

        <Text className="muted-text">Обязательные поля отмечены звёздочкой. Данные проверяются на сервере.</Text>
      </Div>
    </Card>
  );
};
