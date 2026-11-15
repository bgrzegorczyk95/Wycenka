export interface Env {
  DB: D1Database;
  FILES: R2Bucket;
  JOBS: Queue<JobMessage>;
  ASSETS: Fetcher;
  APP_URL: string;
  /** 'development' | 'staging' | 'production' */
  ENVIRONMENT: string;
  BETTER_AUTH_SECRET: string;
  /** 'off' disables Better Auth rate limiting (tests). */
  AUTH_RATE_LIMIT?: string;
  /** SMSAPI.pl token; without it login codes go to the dev outbox / logs (development only). */
  SMSAPI_TOKEN?: string;
  SMSAPI_SENDER?: string;
  /** Resend API key; without it e-mails go to the dev outbox / logs (development only). */
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  MOCK_AI?: string;
  MOCK_PDF?: string;
}

export type JobMessage =
  | { type: 'process-offer'; offerId: string }
  | { type: 'import-price-list'; importId: string }
  | { type: 'render-pdf'; offerId: string };
