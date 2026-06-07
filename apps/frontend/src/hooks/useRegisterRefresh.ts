import { useEffect } from 'react';
import { useRefresh } from '../app/providers/RefreshProvider';

type RefreshHandler = () => Promise<void> | void;

export const useRegisterRefresh = (handler: RefreshHandler, enabled = true) => {
  const { registerRefreshHandler } = useRefresh();

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    return registerRefreshHandler(handler);
  }, [enabled, handler, registerRefreshHandler]);
};
