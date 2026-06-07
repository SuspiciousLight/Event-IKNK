import { createContext, ReactNode, useCallback, useContext, useRef, useState } from 'react';

type RefreshHandler = () => Promise<void> | void;

type RefreshContextValue = {
  isRefreshing: boolean;
  lastUpdatedAt: Date | null;
  refreshError: string | null;
  registerRefreshHandler: (handler: RefreshHandler) => () => void;
  refreshAll: () => Promise<void>;
};

const RefreshContext = createContext<RefreshContextValue | null>(null);

export const RefreshProvider = ({ children }: { children: ReactNode }) => {
  const handlersRef = useRef(new Set<RefreshHandler>());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const registerRefreshHandler = useCallback((handler: RefreshHandler) => {
    handlersRef.current.add(handler);
    return () => {
      handlersRef.current.delete(handler);
    };
  }, []);

  const refreshAll = useCallback(async () => {
    if (handlersRef.current.size === 0 || isRefreshing) {
      return;
    }

    setIsRefreshing(true);
    setRefreshError(null);

    const results = await Promise.allSettled(Array.from(handlersRef.current).map((handler) => handler()));
    const failed = results.some((result) => result.status === 'rejected');

    if (failed) {
      setRefreshError('Не удалось обновить часть данных. Попробуйте ещё раз.');
    } else {
      setLastUpdatedAt(new Date());
    }

    setIsRefreshing(false);
  }, [isRefreshing]);

  return (
    <RefreshContext.Provider
      value={{
        isRefreshing,
        lastUpdatedAt,
        refreshError,
        registerRefreshHandler,
        refreshAll,
      }}
    >
      {children}
    </RefreshContext.Provider>
  );
};

export const useRefresh = () => {
  const context = useContext(RefreshContext);
  if (!context) {
    throw new Error('useRefresh must be used inside RefreshProvider');
  }
  return context;
};
