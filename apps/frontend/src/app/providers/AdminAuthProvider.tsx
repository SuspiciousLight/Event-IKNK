import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Role } from '@diplom/shared';
import { HttpError } from '../../api/client';
import { AdminLoginPayload, authApi } from '../../api/auth.api';
import { AuthMeResponseDto } from '../../api/contracts';

type AdminAuthContextValue = {
  admin: AuthMeResponseDto | null;
  loading: boolean;
  error: string | null;
  isAdmin: boolean;
  refreshAdminSession: () => Promise<AuthMeResponseDto | null>;
  loginAdmin: (payload: AdminLoginPayload) => Promise<AuthMeResponseDto>;
  logoutAdmin: () => Promise<void>;
};

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

const isAuthMiss = (error: unknown): boolean =>
  error instanceof HttpError && (error.status === 401 || error.status === 403);

const toAdminSession = (response: AuthMeResponseDto): AuthMeResponseDto | null =>
  response.role === Role.ADMIN ? response : null;

export const AdminAuthProvider = ({ children }: { children: ReactNode }) => {
  const [admin, setAdmin] = useState<AuthMeResponseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshAdminSession = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await authApi.me();
      const nextAdmin = toAdminSession(response);
      setAdmin(nextAdmin);
      return nextAdmin;
    } catch (requestError: unknown) {
      setAdmin(null);

      if (!isAuthMiss(requestError)) {
        setError(requestError instanceof Error ? requestError.message : 'Не удалось проверить сессию администратора');
      }

      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshAdminSession();
  }, [refreshAdminSession]);

  const loginAdmin = useCallback(async (payload: AdminLoginPayload) => {
    setLoading(true);
    setError(null);

    try {
      const response = await authApi.loginAdmin(payload);
      const nextAdmin = toAdminSession(response);
      if (!nextAdmin) {
        throw new Error('Для входа требуется роль администратора');
      }
      setAdmin(nextAdmin);
      return nextAdmin;
    } catch (requestError: unknown) {
      setAdmin(null);
      setError(requestError instanceof Error ? requestError.message : 'Не удалось войти');
      throw requestError;
    } finally {
      setLoading(false);
    }
  }, []);

  const logoutAdmin = useCallback(async () => {
    try {
      await authApi.logoutAdmin();
    } finally {
      setAdmin(null);
      setError(null);
    }
  }, []);

  const value = useMemo<AdminAuthContextValue>(
    () => ({
      admin,
      loading,
      error,
      isAdmin: Boolean(admin),
      refreshAdminSession,
      loginAdmin,
      logoutAdmin,
    }),
    [admin, error, loading, loginAdmin, logoutAdmin, refreshAdminSession],
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
};

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within AdminAuthProvider');
  }

  return context;
};
