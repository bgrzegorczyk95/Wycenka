import { app } from './app';
import type { Env, JobMessage } from './env';

export default {
  fetch: app.fetch,

  async queue(batch: MessageBatch<JobMessage>, _env: Env): Promise<void> {
    for (const message of batch.messages) {
      // Job handlers arrive in M5 (process-offer), M6 (render-pdf) and M9 (import-price-list).
      console.warn('job_not_implemented', message.body.type);
      message.ack();
    }
  },

  async scheduled(controller: ScheduledController, _env: Env): Promise<void> {
    // Reminders and retention arrive in M7/M10.
    console.log('cron', controller.cron);
  },
} satisfies ExportedHandler<Env, JobMessage>;
