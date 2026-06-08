import { FormEvent, useState } from 'react';
import { Button, Card, Div, FormItem, Input, Select, Text, Title, Textarea } from '@vkontakte/vkui';
import { adminApi } from '../../api/admin.api';
import { AdminFormTemplateDto } from '../../api/contracts';
import { AdminQuestionBuilder, AdminQuestionDraft, createInitialQuestion, normalizeQuestions } from './AdminQuestionBuilder';

type AdminFormBuilderProps = {
  selectedEventId?: string;
  templates: AdminFormTemplateDto[];
  onDone: () => void;
  onError: (message: string) => void;
  mode?: 'form' | 'template' | 'both';
};

const TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'i',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

// Backend requires templateCode to match /^[a-zA-Z0-9_-]+$/. Russian admins type
// Cyrillic names, so we transliterate + slugify to a safe machine code automatically.
const slugify = (input: string): string => {
  let out = '';
  for (const ch of input.trim().toLowerCase()) {
    if (ch in TRANSLIT) out += TRANSLIT[ch];
    else if (/[a-z0-9]/.test(ch)) out += ch;
    else if (/[\s\-_]/.test(ch)) out += '_';
  }
  return out.replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 60);
};

const optionsFromText = (optionsText: string): string[] =>
  optionsText.split(/[\n,]/).map((value) => value.trim()).filter(Boolean);

// Mirror the server-side checks so the admin gets a clear message before submitting.
const validateBuilderQuestions = (questions: AdminQuestionDraft[]): string | null => {
  for (let index = 0; index < questions.length; index += 1) {
    const question = questions[index];
    const label = question.label.trim();
    if (!label) {
      return `Заполните текст вопроса №${index + 1}.`;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(question.fieldKey.trim())) {
      return `Код ответа вопроса №${index + 1}: только латиница, цифры и подчёркивание.`;
    }
    const needsOptions =
      question.questionType === 'SELECT' || question.questionType === 'CHECKBOX' || question.questionType === 'COURSE';
    if (needsOptions && optionsFromText(question.optionsText).length === 0) {
      return `Добавьте варианты ответа для вопроса «${label}».`;
    }
  }
  return null;
};

const fromTemplate = (template: AdminFormTemplateDto): AdminQuestionDraft[] =>
  template.questions.map((question) => ({
    position: question.position,
    fieldKey: question.fieldKey,
    label: question.label,
    questionType: question.questionType,
    isRequired: question.isRequired,
    placeholder: question.placeholder ?? '',
    options: Array.isArray(question.options) ? question.options : [],
    validationRules: question.validationRules ?? undefined,
    optionsText: Array.isArray(question.options) ? question.options.join('\n') : '',
  }));

export const AdminFormBuilder = ({ selectedEventId = '', templates, onDone, onError, mode = 'both' }: AdminFormBuilderProps) => {
  const [questions, setQuestions] = useState<AdminQuestionDraft[]>([createInitialQuestion()]);
  const [sourceTemplateId, setSourceTemplateId] = useState('');
  const [templateCode, setTemplateCode] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [savingForm, setSavingForm] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);

  const applyTemplate = (templateId: string) => {
    setSourceTemplateId(templateId);
    const template = templates.find((item) => item.id === templateId);
    if (template) {
      setQuestions(fromTemplate(template));
    }
  };

  const createForm = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedEventId) {
      onError('Выберите мероприятие для формы.');
      return;
    }

    const questionsError = validateBuilderQuestions(questions);
    if (questionsError) {
      onError(questionsError);
      return;
    }

    setSavingForm(true);
    try {
      await adminApi.createRegistrationForm(selectedEventId, {
        status: 'PUBLISHED',
        sourceTemplateId: sourceTemplateId || undefined,
        questions: normalizeQuestions(questions),
      });
      onDone();
    } catch (requestError: unknown) {
      onError(requestError instanceof Error ? requestError.message : 'Не удалось создать форму');
    } finally {
      setSavingForm(false);
    }
  };

  const saveTemplate = async () => {
    const questionsError = validateBuilderQuestions(questions);
    if (questionsError) {
      onError(questionsError);
      return;
    }

    const code = slugify(templateCode || templateName) || `tpl_${Date.now()}`;

    setSavingTemplate(true);
    try {
      await adminApi.createFormTemplate({
        templateCode: code,
        name: templateName.trim(),
        description: templateDescription.trim() || undefined,
        questions: normalizeQuestions(questions),
      });
      setTemplateCode('');
      setTemplateName('');
      setTemplateDescription('');
      onDone();
    } catch (requestError: unknown) {
      onError(requestError instanceof Error ? requestError.message : 'Не удалось сохранить шаблон');
    } finally {
      setSavingTemplate(false);
    }
  };

  return (
    <div className="admin-form-grid">
      {mode !== 'template' && (
        <form onSubmit={createForm} className="admin-form-grid">
          <Card mode="shadow" className="admin-card">
            <Div className="grid-stack">
              <div>
                <Text className="eyebrow">Шаг 2 · Форма</Text>
                <Title level="3">Форма для выбранного мероприятия</Title>
                <Text className="muted-text">
                  Форма привязывается к конкретному мероприятию. Студенты увидят вопросы при записи.
                </Text>
              </div>
              <FormItem top="Взять вопросы из шаблона">
                <Select
                  value={sourceTemplateId}
                  options={[
                    { label: 'Без шаблона', value: '' },
                    ...templates.map((template) => ({ label: `${template.name} v${template.version}`, value: template.id })),
                  ]}
                  onChange={(event) => applyTemplate(event.target.value)}
                />
              </FormItem>
              <AdminQuestionBuilder questions={questions} onChange={setQuestions} />
              <Button type="submit" loading={savingForm} disabled={!selectedEventId}>Опубликовать форму для мероприятия</Button>
            </Div>
          </Card>
        </form>
      )}

      {mode !== 'form' && (
        <Card mode="shadow" className="admin-card">
          <Div className="admin-form-grid">
            <div>
              <Text className="eyebrow">Шаблон</Text>
              <Title level="3">Заготовка вопросов</Title>
              <Text className="muted-text">
                Шаблон ничего не публикует у студентов. Это только заготовка, которую потом можно выбрать во вкладке «Формы».
              </Text>
            </div>
            <FormItem top="Взять за основу существующий шаблон">
              <Select
                value={sourceTemplateId}
                options={[
                  { label: 'Новый шаблон с нуля', value: '' },
                  ...templates.map((template) => ({ label: `${template.name} v${template.version}`, value: template.id })),
                ]}
                onChange={(event) => applyTemplate(event.target.value)}
              />
            </FormItem>
            <AdminQuestionBuilder questions={questions} onChange={setQuestions} />
            <div className="admin-form-columns">
              <FormItem top="Название шаблона">
                <Input value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="Базовая форма" />
              </FormItem>
              <FormItem top="Код шаблона" bottom="Необязательно — создадим автоматически из названия">
                <Input value={templateCode} onChange={(event) => setTemplateCode(event.target.value)} placeholder="career_day_base" />
              </FormItem>
            </div>
            <FormItem top="Описание шаблона">
              <Textarea value={templateDescription} onChange={(event) => setTemplateDescription(event.target.value)} />
            </FormItem>
            <Button type="button" mode="secondary" loading={savingTemplate} disabled={!templateName.trim()} onClick={saveTemplate}>
              Сохранить шаблон
            </Button>
          </Div>
        </Card>
      )}
    </div>
  );
};
