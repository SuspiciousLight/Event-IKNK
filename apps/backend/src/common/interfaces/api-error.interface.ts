export interface ApiErrorResponse {
  code: string;
  message: string | string[];
  details?: Record<string, unknown>;
  requestId?: string;
  timestamp: string;
  path: string;
}