import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Div, Group, Text, Title } from '@vkontakte/vkui';
import { consentsApi } from '../api/consents.api';
import { ConsentDocumentDto, ConsentRecordDto } from '../api/contracts';
import { ConsentBlock } from '../components/ConsentBlock';
import { PageHero, StateBlock } from '../components/common/Ui';
import { useAppSnackbar } from '../hooks/useAppSnackbar';
import { useRegisterRefresh } from '../hooks/useRegisterRefresh';
import { formatDateTime } from '../utils/format';

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
        title="Согласие на обработку ПД"
        subtitle="Здесь можно прочитать условия обработки данных и заранее сохранить согласие для будущих регистраций."
        action={<Button mode="secondary" onClick={() => navigate('/profile')}>Назад</Button>}
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

            <Card mode="shadow" className="soft-card">
              <Div className="grid-stack">
                <Title level="3">История согласий</Title>
                {consents.length === 0 ? (
                  <Text className="muted-text">Согласия ещё не принимались.</Text>
                ) : (
                  consents.map((consent) => (
                    <div className="admin-table-row" key={consent.id}>
                      <Text weight="2">Версия: {consent.consentVersion}</Text>
                      <Text className="muted-text">Принято: {formatDateTime(consent.acceptedAt)}</Text>
                    </div>
                  ))
                )}
              </Div>
            </Card>
          </div>
        )}
      </StateBlock>
      {snackbar}
    </Group>
  );
};
