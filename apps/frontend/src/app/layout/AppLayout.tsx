import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Text } from '@vkontakte/vkui';
import { useAdminAuth } from '../providers/AdminAuthProvider';
import { AppPullToRefresh } from '../../components/AppPullToRefresh';
import { NotificationOptIn } from '../../components/NotificationOptIn';

type NavItem = {
  id: string;
  icon: string;
  label: string;
  to: string;
  isActive: (pathname: string) => boolean;
};

const NAV_ITEMS: NavItem[] = [
  {
    id: 'events',
    icon: 'AF',
    label: 'Афиша',
    to: '/events',
    isActive: (pathname) => pathname.startsWith('/events'),
  },
  {
    id: 'my-registrations',
    icon: 'M',
    label: 'Записи',
    to: '/my-registrations',
    isActive: (pathname) => pathname.startsWith('/my-registrations') || pathname.startsWith('/reminder'),
  },
  {
    id: 'profile',
    icon: 'LK',
    label: 'Профиль',
    to: '/profile',
    isActive: (pathname) => pathname.startsWith('/profile') || pathname.startsWith('/consent'),
  },
];

export const AppLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin } = useAdminAuth();
  const isAdminRoute = location.pathname.startsWith('/admin');
  const navItems = isAdmin
    ? [
        ...NAV_ITEMS,
        {
          id: 'admin',
          icon: 'AD',
          label: 'Админ',
          to: '/admin',
          isActive: (pathname: string) => pathname.startsWith('/admin'),
        },
      ]
    : NAV_ITEMS;

  return (
    <div className={`app-shell ${isAdminRoute ? 'app-shell-admin' : ''}`}>
      <header className="app-topbar">
        <div className="app-brand">
          <img
            className="app-brand-logo"
            src="/logo.png"
            alt="Логотип приложения"
            width={56}
            height={56}
            onError={(e) => {
              // Fallback to the placeholder SVG until the real PNG is added.
              const img = e.currentTarget;
              if (!img.src.endsWith('/logo.svg')) {
                img.src = '/logo.svg';
              }
            }}
          />
          <div>
            <Text weight="2">{isAdminRoute ? 'Панель администратора' : 'EVENT-отдел ПРОФ.ИКНК'}</Text>
            <Text className="app-brand-caption">
              {isAdminRoute ? 'Формы, участники и рассылки' : 'Запись на мероприятия в пару шагов'}
            </Text>
          </div>
        </div>
      </header>

      <AppPullToRefresh>
        {!isAdminRoute && <NotificationOptIn />}
        <Outlet />
      </AppPullToRefresh>

      <nav className="app-nav" aria-label="Основная навигация">
        {navItems.map((item) => {
          const active = item.isActive(location.pathname);
          return (
            <button
              key={item.id}
              className={`app-nav-button ${active ? 'app-nav-button-active' : ''}`}
              type="button"
              onClick={() => navigate(item.to)}
            >
              <span className="app-nav-icon" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
