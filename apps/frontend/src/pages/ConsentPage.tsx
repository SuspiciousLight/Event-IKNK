import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Div, Group, Text } from '@vkontakte/vkui';
import { consentsApi } from '../api/consents.api';
import { ConsentDocumentDto, ConsentRecordDto } from '../api/contracts';
import { ConsentBlock } from '../components/ConsentBlock';
import { PageHero, StateBlock } from '../components/common/Ui';
import { useAppSnackbar } from '../hooks/useAppSnackbar';
import { useRegisterRefresh } from '../hooks/useRegisterRefresh';

export const ConsentPage = () => {
  const navigate = useNavigate();
  const { snackbar, showError, showSuccess } = useAppSnackbar();
  const [accepted, setAccepted] = useState(false);
  const [consentDocument, setConsentDocument] = useState<ConsentDocumentDto | null>(null);
  const [consents, setConsents] = useState<ConsentRecordDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [document, records] = await Promise.all([consentsApi.getCurrent(), consentsApi.listMy()]);
      setConsentDocument(document);
      setConsents(records);
      setAccepted(records.some((item) => item.consentVersion === document.version && !item.eventId && !item.eventRegistrationId));
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : 'Не удалось загрузить согласия');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useRegisterRefresh(load);

  const saveConsent = async () => {
    if (!consentDocument) {
      showError('Текст согласия не загружен.');
      return;
    }

    if (!accepted) {
      showError('Нужно принять согласие.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await consentsApi.accept({
        consentVersion: consentDocument.version,
        consentTextHash: consentDocument.textHash,
      });
      showSuccess('Согласие сохранено.');
      await load();
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : 'Не удалось сохранить согласие');
      showError('Не удалось сохранить согласие.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Group className="page-section" mode="plain">
      <PageHero
        eyebrow="Персональные данные"
        title="Согласие на обработку данных"
        subtitle="Здесь можно прочитать условия обработки данных для записи на мероприятия."
        action={(
          <>
            <Button mode="secondary" onClick={() => navigate('/profile')}>Назад</Button>
            <Button mode="secondary" onClick={() => navigate('/events')}>Афиша</Button>
          </>
        )}
      />

      <StateBlock loading={loading} error={error}>
        {consentDocument && (
          <div className="grid-stack">
            <Card mode="shadow" className="soft-card">
              <Div className="grid-stack">
                <ConsentBlock
                  accepted={accepted}
                  onToggle={setAccepted}
                  consentVersion={consentDocument.version}
                  consentText={consentDocument.text}
                />
                <Button loading={saving} disabled={!accepted} onClick={saveConsent}>
                  Сохранить согласие
                </Button>
              </Div>
            </Card>

            {consents.length > 0 && (
              <Text className="muted-text">
                Актуальное согласие сохранено. При записи на конкретное мероприятие приложение дополнительно зафиксирует согласие для этой записи.
              </Text>
            )}
          </div>
        )}
      </StateBlock>
      {snackbar}
    </Group>
  );
};
