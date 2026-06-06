import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CURRENT_PERSONAL_DATA_CONSENT } from '../src/modules/consents/current-consent';
import { CreateRegistrationDto } from '../src/modules/registrations/dto/create-registration.dto';

const validPayload = {
  eventId: '11111111-1111-4111-8111-111111111111',
  registrationFormId: '22222222-2222-4222-8222-222222222222',
  answers: [],
  consent: {
    accepted: true,
    version: CURRENT_PERSONAL_DATA_CONSENT.version,
    textHash: CURRENT_PERSONAL_DATA_CONSENT.textHash,
  },
};

const validateDto = (payload: unknown) =>
  validate(plainToInstance(CreateRegistrationDto, payload), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

describe('CreateRegistrationDto consent validation', () => {
  it('requires explicit consent acceptance', async () => {
    const errors = await validateDto({
      ...validPayload,
      consent: {
        version: validPayload.consent.version,
        textHash: validPayload.consent.textHash,
      },
    });

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          property: 'consent',
        }),
      ]),
    );
  });

  it('rejects consent when accepted is false', async () => {
    const errors = await validateDto({
      ...validPayload,
      consent: {
        ...validPayload.consent,
        accepted: false,
      },
    });

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          property: 'consent',
        }),
      ]),
    );
  });

  it('accepts current consent metadata when accepted is true', async () => {
    const errors = await validateDto(validPayload);

    expect(errors).toHaveLength(0);
  });
});
