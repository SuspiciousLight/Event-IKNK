import { Button, Checkbox, FormItem, Input, Select, Text, Textarea } from '@vkontakte/vkui';
import { AdminQuestionPayloadDto, QuestionType } from '../../api/contracts';

export type AdminQuestionDraft = AdminQuestionPayloadDto & {
  optionsText: string;
};

type AdminQuestionBuilderProps = {
  questions: AdminQuestionDraft[];
  onChange: (questions: AdminQuestionDraft[]) => void;
};

const QUESTION_TYPES: Array<{ label: string; value: QuestionType }> = [
  { label: 'Текст', value: 'TEXT' },
  { label: 'Длинный текст', value: 'TEXTAREA' },
  { label: 'Курс', value: 'COURSE' },
  { label: 'Один вариант', value: 'SELECT' },
  { label: 'Несколько вариантов', value: 'CHECKBOX' },
];

const createQuestion = (position: number, fieldKey = `question_${position}`): AdminQuestionDraft => ({
  position,
  fieldKey,
  label: '',
  questionType: 'TEXT',
  isRequired: true,
  placeholder: '',
  options: [],
  optionsText: '',
});

export const normalizeQuestions = (questions: AdminQuestionDraft[]): AdminQuestionPayloadDto[] =>
  questions.map((question, index) => {
    const options = question.optionsText
      .split(/[\n,]/)
      .map((value) => value.trim())
      .filter(Boolean);

    return {
      position: index + 1,
      fieldKey: question.fieldKey.trim(),
      label: question.label.trim(),
      questionType: question.questionType,
      isRequired: question.isRequired,
      placeholder: question.placeholder?.trim() || undefined,
      options: options.length > 0 ? options : undefined,
    };
  });

export const AdminQuestionBuilder = ({ questions, onChange }: AdminQuestionBuilderProps) => {
  const updateQuestion = (index: number, patch: Partial<AdminQuestionDraft>) => {
    onChange(questions.map((question, itemIndex) => (itemIndex === index ? { ...question, ...patch } : question)));
  };

  const moveQuestion = (index: number, direction: -1 | 1) => {
    const next = [...questions];
    const target = index + direction;
    if (target < 0 || target >= next.length) {
      return;
    }
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next.map((question, itemIndex) => ({ ...question, position: itemIndex + 1 })));
  };

  const addQuestion = () => {
    let nextIndex = questions.length + 1;
    while (questions.some((question) => question.fieldKey === `question_${nextIndex}`)) {
      nextIndex += 1;
    }
    onChange([...questions, createQuestion(questions.length + 1, `question_${nextIndex}`)]);
  };

  const removeQuestion = (index: number) => {
    onChange(questions.filter((_, itemIndex) => itemIndex !== index).map((question, itemIndex) => ({
      ...question,
      position: itemIndex + 1,
    })));
  };

  return (
    <div className="admin-question-list">
      {questions.map((question, index) => {
        const needsOptions = question.questionType === 'SELECT' || question.questionType === 'CHECKBOX' || question.questionType === 'COURSE';
        return (
          <div className="admin-question-row" key={`${question.position}-${index}`}>
            <div className="event-card-top">
              <Text weight="2">Вопрос {index + 1}</Text>
              <Text className="muted-text">Порядок: {index + 1}</Text>
            </div>
            <FormItem top="Текст вопроса">
              <Input value={question.label} onChange={(event) => updateQuestion(index, { label: event.target.value })} placeholder="Например: Ваш факультет" />
            </FormItem>
            <div className="admin-form-columns">
              <FormItem top="Тип">
                <Select value={question.questionType} options={QUESTION_TYPES} onChange={(event) => updateQuestion(index, { questionType: event.target.value as QuestionType })} />
              </FormItem>
            </div>
            <FormItem top="Подсказка">
              <Input value={question.placeholder} onChange={(event) => updateQuestion(index, { placeholder: event.target.value })} placeholder="Необязательная подсказка для студента" />
            </FormItem>
            {needsOptions && (
              <FormItem top="Варианты ответа" bottom="Каждый вариант с новой строки или через запятую">
                <Textarea value={question.optionsText} onChange={(event) => updateQuestion(index, { optionsText: event.target.value })} placeholder="1 курс\n2 курс\n3 курс" />
              </FormItem>
            )}
            <FormItem>
              <Checkbox checked={question.isRequired} onChange={(event) => updateQuestion(index, { isRequired: event.currentTarget.checked })}>
                Обязательный вопрос
              </Checkbox>
            </FormItem>
            <div className="inline-actions">
              <Button type="button" size="s" mode="secondary" onClick={() => moveQuestion(index, -1)} disabled={index === 0}>Выше</Button>
              <Button type="button" size="s" mode="secondary" onClick={() => moveQuestion(index, 1)} disabled={index === questions.length - 1}>Ниже</Button>
              <Button type="button" size="s" mode="tertiary" onClick={() => removeQuestion(index)} disabled={questions.length === 1}>Удалить</Button>
            </div>
          </div>
        );
      })}
      <Button type="button" mode="secondary" onClick={addQuestion}>Добавить вопрос</Button>
    </div>
  );
};

export const createInitialQuestion = () => createQuestion(1);
