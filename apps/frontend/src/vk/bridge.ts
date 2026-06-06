import bridge from '@vkontakte/vk-bridge';

export type VkInitState = {
  isReady: boolean;
  isVkMiniApp: boolean;
  vkUserId: number | null;
  launchParamsRaw: string;
  initError?: string;
};

type VkUserInfoResponse = {
  id?: number;
};

type VkAllowNotificationsResponse = {
  result?: boolean;
};

const getVkUserIdFromSearch = (search: string): number | null => {
  const params = new URLSearchParams(search);
  const raw = params.get('vk_user_id');
  if (!raw) {
    return null;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

const getDevVkUserId = (): number | null => {
  if (import.meta.env.PROD) {
    return null;
  }

  const raw = import.meta.env.VITE_DEV_VK_USER_ID ?? '100001';
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('VK Bridge request timeout')), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

const getVkUserIdViaBridge = async (): Promise<number | null> => {
  const userInfo = await withTimeout(
    bridge.send('VKWebAppGetUserInfo') as Promise<VkUserInfoResponse>,
    1800,
  );

  return typeof userInfo.id === 'number' && Number.isFinite(userInfo.id) ? userInfo.id : null;
};

export const initVkBridge = async (): Promise<VkInitState> => {
  const launchParamsRaw = window.location.search;

  try {
    await withTimeout(bridge.send('VKWebAppInit'), 1500);
    const vkUserId = await getVkUserIdViaBridge();

    return {
      isReady: true,
      isVkMiniApp: true,
      vkUserId: vkUserId ?? getVkUserIdFromSearch(launchParamsRaw) ?? getDevVkUserId(),
      launchParamsRaw,
    };
  } catch (error: unknown) {
    return {
      isReady: false,
      isVkMiniApp: false,
      vkUserId: getVkUserIdFromSearch(launchParamsRaw) ?? getDevVkUserId(),
      launchParamsRaw,
      initError: error instanceof Error ? error.message : 'Unable to initialize VK bridge',
    };
  }
};

export const requestVkNotificationsPermission = async (): Promise<boolean> => {
  const hasVkLaunchParams = window.location.search.includes('vk_app_id=');
  if (!hasVkLaunchParams && !import.meta.env.PROD) {
    return true;
  }

  try {
    const response = await withTimeout(
      bridge.send('VKWebAppAllowNotifications') as Promise<VkAllowNotificationsResponse>,
      2500,
    );

    return response.result !== false;
  } catch {
    return false;
  }
};
