import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateProfileDto } from '../src/modules/users/dto/update-profile.dto';

const validateDto = (payload: unknown) =>
  validate(plainToInstance(UpdateProfileDto, payload), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

describe('UpdateProfileDto', () => {
  it('accepts full name, telegram username and explicit disclaimer confirmation', async () => {
    const errors = await validateDto({
      fullName: 'Иванов Иван',
      telegramUsername: '@student_2026',
      disclaimerAccepted: true,
    });

    expect(errors).toHaveLength(0);
  });

  it('rejects phone and email because the profile no longer stores them', async () => {
    const errors = await validateDto({
      fullName: 'Иванов Иван',
      telegramUsername: '@student_2026',
      disclaimerAccepted: true,
      phone: '+79000000000',
      email: 'student@example.com',
    });

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'phone' }),
        expect.objectContaining({ property: 'email' }),
      ]),
    );
  });

  it('rejects telegram username without @ prefix', async () => {
    const errors = await validateDto({
      fullName: 'Иванов Иван',
      telegramUsername: 'student_2026',
      disclaimerAccepted: true,
    });

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'telegramUsername' }),
      ]),
    );
  });

  it('rejects patronymic or any third name part because the profile stores only surname and first name', async () => {
    const errors = await validateDto({
      fullName: 'Иванов Иван Иванович',
      telegramUsername: '@student_2026',
      disclaimerAccepted: true,
    });

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'fullName' }),
      ]),
    );
  });
});
