import { ReactNode } from 'react';
import { StateBlock } from './Ui';

type AsyncBoundaryProps = {
  loading: boolean;
  error?: string | null;
  isEmpty?: boolean;
  emptyText?: string;
  emptyTitle?: string;
  children: ReactNode;
};

export const AsyncBoundary = ({
  loading,
  error,
  isEmpty = false,
  emptyText = 'Данных пока нет',
  emptyTitle = 'Пока пусто',
  children,
}: AsyncBoundaryProps) => (
  <StateBlock
    loading={loading}
    error={error}
    isEmpty={isEmpty}
    empty={{ title: emptyTitle, text: emptyText }}
  >
    {children}
  </StateBlock>
);
