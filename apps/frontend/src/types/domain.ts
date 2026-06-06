import { FormQuestionDto } from '../api/contracts';

export type FormAnswerValue = string | string[] | undefined;

export type FormAnswersMap = Record<string, FormAnswerValue>;

export const toQuestionOptions = (question: FormQuestionDto): string[] => {
  if (!question.options) {
    return [];
  }
  return question.options.filter((option) => typeof option === 'string');
};
