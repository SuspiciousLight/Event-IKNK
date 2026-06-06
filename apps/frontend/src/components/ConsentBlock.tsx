import { useState } from 'react';
import { Button, Checkbox, Text, Title } from '@vkontakte/vkui';

type ConsentBlockProps = {
  accepted: boolean;
  onToggle: (accepted: boolean) => void;
  consentVersion: string;
  consentText: string;
};

export const ConsentBlock = ({ accepted, onToggle, consentVersion, consentText }: ConsentBlockProps) => {
  const [isTextOpen, setIsTextOpen] = useState(false);

  return (
    <div className="consent-box">
      <div>
        <Title level="3">Согласие на обработку персональных данных</Title>
        <Text className="muted-text">
          Мы используем данные только для регистрации на мероприятие, связи по организационным вопросам и напоминаний.
        </Text>
      </div>

      <Checkbox checked={accepted} onChange={(event) => onToggle(event.currentTarget.checked)}>
        Подтверждаю согласие на обработку персональных данных для цели регистрации на мероприятие.
      </Checkbox>

      <div className="inline-actions">
        <Button mode="secondary" size="s" onClick={() => setIsTextOpen((prev) => !prev)}>
          {isTextOpen ? 'Скрыть текст согласия' : 'Прочитать текст согласия'}
        </Button>
      </div>

      {isTextOpen && <Text className="consent-text">{consentText || 'Текст согласия временно недоступен.'}</Text>}
      <Text className="muted-text">Версия согласия: {consentVersion || 'не загружена'}</Text>
    </div>
  );
};
