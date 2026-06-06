import { PaginationDto, Role } from '@diplom/shared';
export type { PaginationDto } from '@diplom/shared';

export type QuestionType =
  | 'TEXT'
  | 'TEXTAREA'
  | 'PHONE'
  | 'EMAIL'
  | 'SELECT'
  | 'CHECKBOX'
  | 'COURSE'
  | 'DATE'
  | 'NUMBER';

export type EventSummaryDto = {
  id: string;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string;
  location: string | null;
  capacity: number | null;
  registeredCount?: number;
  availableSeats?: number | null;
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  myRegistrationId?: string | null;
  myWaitlistStatus?: 'ACTIVE' | 'CANCELED' | 'NOTIFIED' | null;
};

export type FormQuestionDto = {
  id: string;
  position: number;
  fieldKey: string;
  label: string;
  questionType: QuestionType;
  isRequired: boolean;
  placeholder: string | null;
  options: string[] | null;
  validationRules: Record<string, unknown> | null;
};

export type ActiveFormDto = {
  id: string;
  version: number;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  publishedAt: string | null;
  questions: FormQuestionDto[];
};

export type EventCardResponseDto = {
  event: EventSummaryDto;
  activeForm: ActiveFormDto | null;
  myRegistration?: { id: string } | null;
  myWaitlistSubscription?: WaitlistSubscriptionDto | null;
};

export type PaginatedResponseDto<TItem> = {
  items: TItem[];
  meta: PaginationDto;
};

export type RegistrationAnswerInputDto = {
  questionKey: string;
  answerText?: string;
  answerJson?: Record<string, unknown>;
};

export type RegistrationCreateDto = {
  eventId: string;
  registrationFormId?: string;
  answers?: RegistrationAnswerInputDto[];
  consent: {
    accepted: true;
    version: string;
    textHash: string;
  };
};

export type RegistrationListItemDto = {
  id: string;
  eventId: string;
  status: 'ACTIVE' | 'CANCELED';
  registeredAt: string;
  canceledAt?: string | null;
  cancelReason?: string | null;
  event?: {
    id: string;
    title: string;
    startAt: string;
    endAt: string;
    location: string | null;
    status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  };
  isEventFinished?: boolean;
  activeReminder?: ReminderDto | null;
};

export type UserProfileDto = {
  id: string;
  userId: string;
  fullName: string;
  telegramUsername: string | null;
  disclaimerAccepted: boolean;
  disclaimerAcceptedAt: string | null;
  disclaimerVersion: string | null;
  currentDisclaimerVersion: string;
  isActive: boolean;
  deactivatedAt?: string | null;
  updatedAt: string;
};

export type ProfileDisclaimerDto = {
  version: string;
  title: string;
  text: string;
};

export type ConsentDocumentDto = {
  consentType: 'PERSONAL_DATA_PROCESSING';
  version: string;
  textHash: string;
  text: string;
};

export type ConsentRecordDto = {
  id: string;
  eventId: string | null;
  eventRegistrationId: string | null;
  consentVersion: string;
  consentTextHash: string;
  acceptedAt: string;
};

export type RegistrationCreatedDto = RegistrationListItemDto & {
  profileUsed: Pick<UserProfileDto, 'id' | 'fullName' | 'telegramUsername'>;
  consent: {
    version: string;
    textHash: string;
    acceptedAt: string;
  };
};

export type ReminderDto = {
  id: string;
  eventId?: string;
  eventRegistrationId?: string | null;
  remindAt: string;
  status: 'SCHEDULED' | 'SENT' | 'CANCELED' | 'FAILED';
  canceledAt?: string | null;
};

export type AuthMeResponseDto = {
  sub: string;
  role: Role;
  adminId?: string;
};

export type AdminRegistrationRowDto = {
  id: string;
  status: 'ACTIVE' | 'CANCELED';
  registeredAt: string;
  canceledAt: string | null;
  userProfile: {
    fullName: string;
    vkUserId: string | null;
    telegramUsername: string | null;
  };
};

export type WaitlistSubscriptionDto = {
  id: string;
  status: 'ACTIVE' | 'CANCELED' | 'NOTIFIED';
  createdAt: string;
  notifiedAt: string | null;
  canceledAt: string | null;
};

export type WaitlistStatusDto = {
  eventId: string;
  capacity: number | null;
  registeredCount: number;
  availableSeats: number | null;
  isFull: boolean;
  myRegistration: { id: string } | null;
  subscription: WaitlistSubscriptionDto | null;
  canSubscribe: boolean;
};

export type AdminEventDto = EventSummaryDto & {
  _count?: {
    registrations: number;
    forms: number;
  };
};

export type AdminQuestionPayloadDto = {
  position: number;
  fieldKey: string;
  label: string;
  questionType: QuestionType;
  isRequired: boolean;
  placeholder?: string;
  options?: string[];
  validationRules?: Record<string, unknown>;
};

export type AdminFormTemplateDto = {
  id: string;
  templateCode: string;
  version: number;
  name: string;
  description: string | null;
  isActive: boolean;
  questions: FormQuestionDto[];
};

export type NotificationCampaignDto = {
  id: string;
  status: 'DRAFT' | 'QUEUED' | 'SENT' | 'FAILED';
  title: string;
  createdAt: string;
  recipientsCount: number;
};

export type AuditLogDto = {
  id: string;
  actorId: string | null;
  actorRole: Role | null;
  action: string;
  targetType: string;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};
