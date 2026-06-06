import { ReactNode } from 'react';
import { Button, Card, Div, Placeholder, Spinner, Text, Title } from '@vkontakte/vkui';

type PageHeroProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
};

export const PageHero = ({ eyebrow, title, subtitle, action }: PageHeroProps) => (
  <section className="page-hero">
    <div>
      {eyebrow && <Text className="eyebrow">{eyebrow}</Text>}
      <Title level="1" className="page-title">{title}</Title>
      {subtitle && <Text className="page-subtitle">{subtitle}</Text>}
    </div>
    {action && <div className="page-hero-action">{action}</div>}
  </section>
);

type EmptyStateProps = {
  title: string;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
};

export const EmptyState = ({ title, text, actionLabel, onAction }: EmptyStateProps) => (
  <Card mode="shadow" className="empty-card">
    <Div>
      <div className="empty-illustration" aria-hidden="true">*</div>
      <Title level="3">{title}</Title>
      <Text className="muted-text">{text}</Text>
      {actionLabel && onAction && (
        <Button mode="primary" size="m" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </Div>
  </Card>
);

type StateBlockProps = {
  loading: boolean;
  error?: string | null;
  isEmpty?: boolean;
  empty?: EmptyStateProps;
  children: ReactNode;
};

export const StateBlock = ({ loading, error, isEmpty = false, empty, children }: StateBlockProps) => {
  if (loading) {
    return (
      <div className="state-shell">
        <Spinner size="l" />
        <Text className="muted-text">Загружаем данные...</Text>
      </div>
    );
  }

  if (error) {
    return (
      <Placeholder className="state-shell">
        <Title level="3">Не получилось загрузить данные</Title>
        <Text className="muted-text">{error}</Text>
      </Placeholder>
    );
  }

  if (isEmpty && empty) {
    return <EmptyState {...empty} />;
  }

  return <>{children}</>;
};

type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'accent';

export const StatusBadge = ({ children, tone = 'neutral' }: { children: ReactNode; tone?: BadgeTone }) => (
  <span className={`status-badge status-badge-${tone}`}>{children}</span>
);

export const InfoRow = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="info-row">
    <Text className="muted-text">{label}</Text>
    <Text weight="2">{value}</Text>
  </div>
);
