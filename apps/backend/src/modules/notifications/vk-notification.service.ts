import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type VkApiError = {
  error_code?: number;
  error_msg?: string;
};

type VkNotificationsResponse = {
  response?: unknown;
  error?: VkApiError;
};

@Injectable()
export class VkNotificationService {
  private readonly apiVersion: string;
  private readonly endpoint = 'https://api.vk.com/method/notifications.sendMessage';
  private readonly serviceToken?: string;
  private readonly enabled: boolean;

  constructor(configService: ConfigService) {
    this.apiVersion = configService.get<string>('VK_API_VERSION', '5.199');
    this.serviceToken =
      configService.get<string>('VK_SERVICE_TOKEN') ||
      configService.get<string>('VK_APP_SERVICE_KEY') ||
      configService.get<string>('VK_APP_SECRET');
    this.enabled = configService.get<string>('VK_NOTIFICATIONS_ENABLED', 'false') === 'true';
  }

  isReady(): boolean {
    return this.enabled && !!this.serviceToken;
  }

  async sendToUser(vkUserId: string | null | undefined, message: string, fragment?: string): Promise<void> {
    const normalizedUserId = vkUserId?.trim();
    if (!this.isReady()) {
      throw new Error('VK_NOTIFICATIONS_DISABLED');
    }

    if (!normalizedUserId || !/^\d+$/.test(normalizedUserId)) {
      throw new Error('VK_USER_ID_MISSING');
    }

    const params = new URLSearchParams();
    params.set('user_ids', normalizedUserId);
    params.set('message', this.normalizeMessage(message));
    params.set('access_token', this.serviceToken as string);
    params.set('v', this.apiVersion);

    if (fragment) {
      params.set('fragment', fragment.replace(/^#/, '').slice(0, 255));
    }

    const response = await fetch(this.endpoint, {
      method: 'POST',
      body: params,
    });

    const payload = (await response.json()) as VkNotificationsResponse;
    if (!response.ok || payload.error) {
      const code = payload.error?.error_code ?? response.status;
      throw new Error(`VK_API_ERROR_${code}`);
    }
  }

  toSafeError(error: unknown): string {
    if (error instanceof Error) {
      return error.message.slice(0, 240);
    }

    return 'VK_NOTIFICATION_SEND_FAILED';
  }

  private normalizeMessage(message: string): string {
    const normalized = message.replace(/\s+/g, ' ').trim();
    return normalized.length > 240 ? `${normalized.slice(0, 237)}...` : normalized;
  }
}
