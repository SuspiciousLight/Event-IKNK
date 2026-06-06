import { ReactNode, useCallback, useMemo, useState } from 'react';
import { Snackbar } from '@vkontakte/vkui';

type SnackbarState = {
  message: string;
  kind: 'success' | 'error';
};

export const useAppSnackbar = () => {
  const [state, setState] = useState<SnackbarState | null>(null);

  const showSuccess = useCallback((message: string) => {
    setState({ message, kind: 'success' });
  }, []);

  const showError = useCallback((message: string) => {
    setState({ message, kind: 'error' });
  }, []);

  const snackbar = useMemo<ReactNode>(() => {
    if (!state) {
      return null;
    }

    return (
      <Snackbar
        onClose={() => setState(null)}
        before={<span className={`snackbar-dot snackbar-dot-${state.kind}`} />}
      >
        {state.message}
      </Snackbar>
    );
  }, [state]);

  return { snackbar, showSuccess, showError };
};
