import { useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppRoot, Div, Spinner } from '@vkontakte/vkui';
import { configureApiClient } from '../api/client';
import { AdminAuthProvider, useAdminAuth } from './providers/AdminAuthProvider';
import { CurrentProfileProvider } from './providers/CurrentProfileProvider';
import { RefreshProvider } from './providers/RefreshProvider';
import { AppLayout } from './layout/AppLayout';
import { AdminLoginPage } from '../pages/AdminLoginPage';
import { AdminPanelPage } from '../pages/AdminPanelPage';
import { ConsentPage } from '../pages/ConsentPage';
import { EventDetailsPage } from '../pages/EventDetailsPage';
import { EventsListPage } from '../pages/EventsListPage';
import { MyRegistrationsPage } from '../pages/MyRegistrationsPage';
import { ProfileAutofillPage } from '../pages/ProfileAutofillPage';
import { RegistrationWizardPage } from '../pages/RegistrationWizardPage';
import { ReminderPage } from '../pages/ReminderPage';
import { initVkBridge, VkInitState } from '../vk/bridge';

const AdminRoute = () => {
  const { isAdmin, loading } = useAdminAuth();

  if (loading) {
    return (
      <Div className="center-state">
        <Spinner size="l" />
      </Div>
    );
  }

  return isAdmin ? <AdminPanelPage /> : <AdminLoginPage />;
};

const AdminLoginRoute = () => {
  const { isAdmin, loading } = useAdminAuth();

  if (loading) {
    return (
      <Div className="center-state">
        <Spinner size="l" />
      </Div>
    );
  }

  return isAdmin ? <Navigate to="/admin" replace /> : <AdminLoginPage />;
};

export const App = () => {
  const [vkState, setVkState] = useState<VkInitState | null>(null);

  useEffect(() => {
    let isMounted = true;

    initVkBridge()
      .then((state) => {
        if (!isMounted) {
          return;
        }
        configureApiClient({
          vkUserId: state.vkUserId,
          launchParamsRaw: state.launchParamsRaw,
        });
        setVkState(state);
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return;
        }
        setVkState({
          isReady: false,
          isVkMiniApp: false,
          vkUserId: null,
          launchParamsRaw: window.location.search,
          initError: error instanceof Error ? error.message : 'Bridge initialization failed',
        });
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (!vkState) {
    return (
      <AppRoot>
        <Div className="center-state">
          <Spinner size="l" />
        </Div>
      </AppRoot>
    );
  }

  return (
    <AppRoot mode="embedded">
      <AdminAuthProvider>
        <CurrentProfileProvider>
          <RefreshProvider>
            <HashRouter>
              <Routes>
                <Route element={<AppLayout />}>
                  <Route path="/" element={<Navigate to="/events" replace />} />
                  <Route path="/events" element={<EventsListPage />} />
                  <Route path="/events/:eventId" element={<EventDetailsPage />} />
                  <Route path="/events/:eventId/register" element={<RegistrationWizardPage />} />
                  <Route path="/my-registrations" element={<MyRegistrationsPage />} />
                  <Route path="/profile" element={<ProfileAutofillPage />} />
                  <Route path="/consent" element={<ConsentPage />} />
                  <Route path="/reminder/:registrationId" element={<ReminderPage />} />
                  <Route path="/admin-login" element={<AdminLoginRoute />} />
                  <Route path="/admin" element={<AdminRoute />} />
                  <Route path="*" element={<Navigate to="/events" replace />} />
                </Route>
              </Routes>
            </HashRouter>
          </RefreshProvider>
        </CurrentProfileProvider>
      </AdminAuthProvider>
    </AppRoot>
  );
};
