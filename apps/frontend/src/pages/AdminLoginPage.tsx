import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Div, FormItem, Group, Input, Text, Title } from '@vkontakte/vkui';
import { useAdminAuth } from '../app/providers/AdminAuthProvider';
import { PageHero, StatusBadge } from '../components/common/Ui';
import { useAppSnackbar } from '../hooks/useAppSnackbar';

export const AdminLoginPage = () => {
  const navigate = useNavigate();
  const { snackbar, showError, showSuccess } = useAppSnackbar();
  const { loginAdmin, loading, error } = useAdminAuth();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    try {
      await loginAdmin({ login: login.trim(), password });
      showSuccess('Вход выполнен.');
      navigate('/admin', { replace: true });
    } catch (requestError: unknown) {
      showError(requestError instanceof Error ? requestError.message : 'Не удалось войти');
    }
  };

  return (
    <Group className="page-section" mode="plain">
      <PageHero
        eyebrow="Администрирование"
        title="Вход администратора"
        subtitle="Раздел закрыт для обычных пользователей. Войдите, чтобы управлять мероприятиями и участниками."
        action={(
          <>
            <Button mode="secondary" onClick={() => navigate('/profile')}>Назад</Button>
            <Button mode="secondary" onClick={() => navigate('/events')}>Афиша</Button>
          </>
        )}
      />

      <Card mode="shadow" className="admin-login-card soft-card">
        <Div className="grid-stack">
          <div>
            <StatusBadge tone="warning">Только admin</StatusBadge>
            <Title level="3">Управление мероприятиями</Title>
            <Text className="muted-text">После входа можно создавать мероприятия, формы, смотреть участников и экспортировать Excel.</Text>
          </div>

          <form onSubmit={submit} className="admin-form-grid">
            <FormItem top="Логин администратора">
              <Input value={login} onChange={(event) => setLogin(event.target.value)} autoComplete="username" placeholder="admin@example.com" required />
            </FormItem>
            <FormItem top="Пароль">
              <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
            </FormItem>
            <Button type="submit" loading={loading} disabled={!login.trim() || !password}>
              Войти в админ-панель
            </Button>
          </form>

          {error && <Text className="status-badge status-badge-danger">{error}</Text>}
        </Div>
      </Card>
      {snackbar}
    </Group>
  );
};
