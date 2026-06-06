import { config } from 'dotenv';
import { resolve } from 'path';
import { hash } from 'bcryptjs';
import {
  EventStatus,
  FormStatus,
  Prisma,
  PrismaClient,
  QuestionType,
  Role,
} from '@prisma/client';

config({ path: resolve(__dirname, '../../../.env') });

const prisma = new PrismaClient();

// Fixed ids keep the seed idempotent: re-running updates the same demo rows.
const TEMPLATE_ID = '11111111-1111-4111-8111-111111111111';
const EVENT_CAREER_ID = '22222222-2222-4222-8222-222222222222';
const FORM_CAREER_ID = '33333333-3333-4333-8333-333333333333';
const EVENT_RESUME_ID = '44444444-4444-4444-8444-444444444444';
const FORM_RESUME_ID = '55555555-5555-4555-8555-555555555555';

const CURRENT_PROFILE_DISCLAIMER_VERSION = 'v1.0-2026-06-05';

type SeedQuestion = {
  position: number;
  fieldKey: string;
  label: string;
  questionType: QuestionType;
  isRequired: boolean;
  placeholder?: string;
  options?: string[];
};

// The profile already contains full name + Telegram username, so demo forms ask
// only event-specific information.
const DEMO_QUESTIONS: SeedQuestion[] = [
  { position: 1, fieldKey: 'course', label: 'Курс', questionType: QuestionType.COURSE, isRequired: true, options: ['1 курс', '2 курс', '3 курс', '4 курс', 'Магистратура'] },
  { position: 2, fieldKey: 'faculty', label: 'Факультет', questionType: QuestionType.SELECT, isRequired: true, options: ['ИТ', 'Экономика', 'Юриспруденция', 'Лингвистика'] },
  { position: 3, fieldKey: 'interests', label: 'Что интересно на мероприятии', questionType: QuestionType.CHECKBOX, isRequired: false, options: ['Стажировки', 'Нетворкинг', 'Лекции', 'Карьерная консультация'] },
  { position: 4, fieldKey: 'comment', label: 'Комментарий организатору', questionType: QuestionType.TEXTAREA, isRequired: false, placeholder: 'Необязательно' },
];

const toOptionsJson = (options?: string[]): Prisma.InputJsonValue | undefined =>
  options && options.length > 0 ? options : undefined;

async function seedAdmin() {
  const adminLogin = (process.env.ADMIN_LOGIN || 'admin@example.com').toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
  const adminFullName = process.env.ADMIN_FULL_NAME || 'Main Admin';
  const passwordHash = await hash(adminPassword, 10);

  const user = await prisma.user.upsert({
    where: { vkUserId: `seed-admin-${adminLogin}`.slice(0, 32) },
    update: { role: Role.ADMIN, status: 'ACTIVE' },
    create: {
      role: Role.ADMIN,
      status: 'ACTIVE',
      vkUserId: `seed-admin-${adminLogin}`.slice(0, 32),
    },
  });

  const admin = await prisma.admin.upsert({
    where: { login: adminLogin },
    update: { userId: user.id, passwordHash, isActive: true },
    create: { userId: user.id, login: adminLogin, passwordHash, isActive: true },
  });

  await prisma.userProfile.upsert({
    where: { userId: user.id },
    update: {
      fullName: adminFullName,
      telegramUsername: '@admin_polytech',
      disclaimerAccepted: true,
      disclaimerAcceptedAt: new Date(),
      disclaimerVersion: CURRENT_PROFILE_DISCLAIMER_VERSION,
    },
    create: {
      userId: user.id,
      fullName: adminFullName,
      telegramUsername: '@admin_polytech',
      disclaimerAccepted: true,
      disclaimerAcceptedAt: new Date(),
      disclaimerVersion: CURRENT_PROFILE_DISCLAIMER_VERSION,
    },
  });

  return admin;
}

async function seedTemplate(adminId: string) {
  await prisma.formTemplate.upsert({
    where: { templateCode_version: { templateCode: 'career_day_base', version: 1 } },
    update: {
      name: 'Базовая форма мероприятия',
      description: 'Стандартный набор вопросов для записи студентов без лишних контактных данных',
      isActive: true,
      createdByAdminId: adminId,
    },
    create: {
      id: TEMPLATE_ID,
      templateCode: 'career_day_base',
      version: 1,
      name: 'Базовая форма мероприятия',
      description: 'Стандартный набор вопросов для записи студентов без лишних контактных данных',
      isActive: true,
      createdByAdminId: adminId,
    },
  });

  await prisma.templateQuestion.deleteMany({ where: { templateId: TEMPLATE_ID } });
  await prisma.templateQuestion.createMany({
    data: DEMO_QUESTIONS.map((question) => ({
      templateId: TEMPLATE_ID,
      position: question.position,
      fieldKey: question.fieldKey,
      label: question.label,
      questionType: question.questionType,
      isRequired: question.isRequired,
      placeholder: question.placeholder,
      options: toOptionsJson(question.options),
    })),
  });
}

async function seedEventWithForm(params: {
  adminId: string;
  eventId: string;
  formId: string;
  title: string;
  description: string;
  location: string;
  capacity: number | null;
  startOffsetDays: number;
}) {
  const startAt = new Date();
  startAt.setDate(startAt.getDate() + params.startOffsetDays);
  startAt.setHours(12, 0, 0, 0);
  const endAt = new Date(startAt);
  endAt.setHours(15, 0, 0, 0);

  await prisma.event.upsert({
    where: { id: params.eventId },
    update: {
      title: params.title,
      description: params.description,
      startAt,
      endAt,
      location: params.location,
      capacity: params.capacity,
      status: EventStatus.PUBLISHED,
      createdByAdminId: params.adminId,
    },
    create: {
      id: params.eventId,
      title: params.title,
      description: params.description,
      startAt,
      endAt,
      location: params.location,
      capacity: params.capacity,
      status: EventStatus.PUBLISHED,
      createdByAdminId: params.adminId,
    },
  });

  await prisma.registrationForm.upsert({
    where: { eventId_version: { eventId: params.eventId, version: 1 } },
    update: { status: FormStatus.PUBLISHED, publishedAt: new Date(), sourceTemplateId: TEMPLATE_ID, createdByAdminId: params.adminId },
    create: {
      id: params.formId,
      eventId: params.eventId,
      version: 1,
      status: FormStatus.PUBLISHED,
      publishedAt: new Date(),
      sourceTemplateId: TEMPLATE_ID,
      createdByAdminId: params.adminId,
    },
  });

  await prisma.formQuestion.deleteMany({ where: { formId: params.formId } });
  await prisma.formQuestion.createMany({
    data: DEMO_QUESTIONS.map((question) => ({
      formId: params.formId,
      position: question.position,
      fieldKey: question.fieldKey,
      label: question.label,
      questionType: question.questionType,
      isRequired: question.isRequired,
      placeholder: question.placeholder,
      options: toOptionsJson(question.options),
    })),
  });
}

async function main() {
  const admin = await seedAdmin();
  await seedTemplate(admin.id);

  await seedEventWithForm({
    adminId: admin.id,
    eventId: EVENT_CAREER_ID,
    formId: FORM_CAREER_ID,
    title: 'День карьеры 2026',
    description: 'Встречи с работодателями, стажировки и карьерные консультации для студентов всех курсов.',
    location: 'Главный корпус, актовый зал',
    capacity: null,
    startOffsetDays: 7,
  });

  await seedEventWithForm({
    adminId: admin.id,
    eventId: EVENT_RESUME_ID,
    formId: FORM_RESUME_ID,
    title: 'Мастер-класс: сильное резюме',
    description: 'Практический воркшоп: как составить резюме, которое заметят. Ограниченное число мест.',
    location: 'Корпус Б, аудитория 312',
    capacity: 30,
    startOffsetDays: 14,
  });

  // eslint-disable-next-line no-console
  console.log('Seed complete: admin, 1 template, 2 published events with published forms.');
}

main()
  .catch(async (error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
