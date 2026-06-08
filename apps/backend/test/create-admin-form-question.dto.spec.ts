import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateAdminFormQuestionDto } from '../src/modules/admin/dto/create-admin-form-question.dto';

const validateDto = (payload: unknown) =>
  validate(plainToInstance(CreateAdminFormQuestionDto, payload), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

const baseQuestion = {
  position: 1,
  fieldKey: 'faculty',
  label: 'Факультет',
  questionType: 'SELECT',
  isRequired: true,
  options: ['ИТ', 'Экономика'],
};

describe('CreateAdminFormQuestionDto', () => {
  it('accepts only non-contact question types used by the MVP', async () => {
    const errors = await validateDto(baseQuestion);

    expect(errors).toHaveLength(0);
  });

  it.each(['PHONE', 'EMAIL'])('rejects %s because phone and email are not collected in the MVP', async (questionType) => {
    const errors = await validateDto({
      ...baseQuestion,
      questionType,
    });

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'questionType' }),
      ]),
    );
  });
});
