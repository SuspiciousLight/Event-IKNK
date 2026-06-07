import { ReactNode, TouchEvent, useMemo, useRef, useState } from 'react';
import { Button, Text } from '@vkontakte/vkui';
import { useRefresh } from '../app/providers/RefreshProvider';

const TRIGGER_DISTANCE = 66;
const MAX_DISTANCE = 96;

export const AppPullToRefresh = ({ children }: { children: ReactNode }) => {
  const { isRefreshing, lastUpdatedAt, refreshError, refreshAll } = useRefresh();
  const contentRef = useRef<HTMLElement | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const supportsTouch = useMemo(
    () => typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0),
    [],
  );

  const isAtTop = () => (contentRef.current?.scrollTop ?? 0) <= 0;

  const handleTouchStart = (event: TouchEvent<HTMLElement>) => {
    if (isRefreshing || !isAtTop()) {
      touchStartYRef.current = null;
      return;
    }

    touchStartYRef.current = event.touches[0]?.clientY ?? null;
  };

  const handleTouchMove = (event: TouchEvent<HTMLElement>) => {
    const startY = touchStartYRef.current;
    if (startY === null || !isAtTop()) {
      return;
    }

    const currentY = event.touches[0]?.clientY ?? startY;
    const delta = currentY - startY;
    if (delta <= 0) {
      setPullDistance(0);
      return;
    }

    setPullDistance(Math.min(MAX_DISTANCE, delta * 0.55));
  };

  const handleTouchEnd = () => {
    const shouldRefresh = pullDistance >= TRIGGER_DISTANCE;
    touchStartYRef.current = null;
    setPullDistance(0);

    if (shouldRefresh) {
      void refreshAll();
    }
  };

  const indicatorText = isRefreshing
    ? 'Обновляем данные...'
    : pullDistance >= TRIGGER_DISTANCE
      ? 'Отпустите, чтобы обновить'
      : 'Потяните вниз для обновления';

  return (
    <main
      ref={contentRef}
      className="app-content"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <div
        className={`pull-refresh-indicator ${isRefreshing || pullDistance > 0 ? 'pull-refresh-indicator-visible' : ''}`}
        style={{ transform: `translateY(${isRefreshing ? 18 : Math.max(0, pullDistance - 48)}px)` }}
        aria-live="polite"
      >
        <span className={`pull-refresh-spinner ${isRefreshing ? 'pull-refresh-spinner-active' : ''}`} aria-hidden="true" />
        <Text>{indicatorText}</Text>
      </div>

      {!supportsTouch && (
        <div className="refresh-fallback">
          <Text className="muted-text">
            Автообновление включено. Если данные устарели, обновите экран вручную.
            {lastUpdatedAt ? ` Последнее обновление: ${lastUpdatedAt.toLocaleTimeString()}.` : ''}
          </Text>
          <Button size="s" mode="secondary" loading={isRefreshing} onClick={() => void refreshAll()}>
            Обновить
          </Button>
        </div>
      )}

      {refreshError && <Text className="status-badge status-badge-warning">{refreshError}</Text>}
      {children}
    </main>
  );
};
