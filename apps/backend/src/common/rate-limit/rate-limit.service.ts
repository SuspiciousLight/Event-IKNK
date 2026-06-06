import { Injectable } from '@nestjs/common';
import { RateLimitOptions } from '../decorators/rate-limit.decorator';

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

@Injectable()
export class RateLimitService {
  private readonly buckets = new Map<string, RateLimitBucket>();

  hit(key: string, options: RateLimitOptions): { allowed: boolean; retryAfterMs: number } {
    const now = Date.now();
    const bucket = this.buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      this.cleanup(now);
      return { allowed: true, retryAfterMs: 0 };
    }

    bucket.count += 1;
    const retryAfterMs = Math.max(bucket.resetAt - now, 0);
    return {
      allowed: bucket.count <= options.limit,
      retryAfterMs,
    };
  }

  private cleanup(now: number): void {
    if (this.buckets.size < 10_000) {
      return;
    }

    for (const [key, bucket] of this.buckets.entries()) {
      if (bucket.resetAt <= now) {
        this.buckets.delete(key);
      }
    }
  }
}
