import { Checkbox, FormItem, Input, Select, Textarea, Text } from '@vkontakte/vkui';
import { FormQuestionDto } from '../api/contracts';
import { toQuestionOptions } from '../types/domain';

type QuestionRendererProps = {
  question: FormQuestionDto;
  value: string | string[] | undefined;
  onChange: (value: string | string[]) => void;
};

const isChecked = (value: string | string[] | undefined, option: string) =>
  Array.isArray(value) ? value.includes(option) : false;

const getHelpText = (question: FormQuestionDto): string | null => {
  if (question.questionType === 'PHONE') {
    return 'Можно указать номер в формате +7 900 000 00 00.';
  }

  if (question.questionType === 'EMAIL') {
    return 'На email могут прийти организационные уведомления.';
  }

  if (question.questionType === 'CHECKBOX') {
    return 'Можно выбрать несколько вариантов.';
  }

  return null;
};

export const QuestionRenderer = ({ question, value, onChange }: QuestionRendererProps) => {
  const options = toQuestionOptions(question);
  const top = `${question.label}${question.isRequired ? ' *' : ''}`;
  const helpText = getHelpText(question);

  if (question.questionType === 'TEXTAREA') {
    return (
      <FormItem top={top} bottom={helpText ?? undefined}>
        <Textarea
          value={typeof value === 'string' ? value : ''}
          placeholder={question.placeholder || 'Введите ответ'}
          onChange={(event) => onChange(event.target.value)}
        />
      </FormItem>
    );
  }

  if (question.questionType === 'SELECT' || question.questionType === 'COURSE') {
    return (
      <FormItem top={top} bottom={helpText ?? undefined}>
        <Select
          value={typeof value === 'string' ? value : ''}
          options={[
            { label: question.questionType === 'COURSE' ? 'Выберите курс' : 'Выберите вариант', value: '' },
            ...options.map((option) => ({ label: option, value: option })),
          ]}
          onChange={(event) => onChange(event.target.value)}
        />
      </FormItem>
    );
  }

  if (question.questionType === 'CHECKBOX') {
    const selected = Array.isArray(value) ? value : [];
    return (
      <FormItem top={top} bottom={helpText ?? undefined}>
        <div className="question-checkboxes">
          {options.length === 0 && <Text className="muted-text">Варианты ответа не настроены.</Text>}
          {options.map((option) => (
            <Checkbox
              key={option}
              checked={isChecked(value, option)}
              onChange={(event) => {
                const next = event.currentTarget.checked
                  ? [...selected, option]
                  : selected.filter((item) => item !== option);
                onChange(next);
              }}
            >
              {option}
            </Checkbox>
          ))}
        </div>
      </FormItem>
    );
  }

  const inputType =
    question.questionType === 'EMAIL'
      ? 'email'
      : question.questionType === 'PHONE'
        ? 'tel'
        : question.questionType === 'NUMBER'
          ? 'number'
          : question.questionType === 'DATE'
            ? 'date'
            : 'text';

  return (
    <FormItem top={top} bottom={helpText ?? undefined}>
      <Input
        type={inputType}
        value={typeof value === 'string' ? value : ''}
        placeholder={question.placeholder || 'Введите ответ'}
        onChange={(event) => onChange(event.target.value)}
      />
    </FormItem>
  );
};
