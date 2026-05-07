export type Env = {
  DB: D1Database;
  MEDIA: R2Bucket;
  MEDIA_PUBLIC_URL: string;
  CF_ACCOUNT_ID: string;
  CF_STREAM_API_TOKEN: string;
  ADMIN_EMAIL: string;
  KILL_SWITCH_TOKEN: string;
};
