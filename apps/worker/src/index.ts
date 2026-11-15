import { app } from './app';
import type { Env, JobMessage } from './env';
import { processOffer } from './jobs/processOffer';

/** In development with MOCK_AI the steps are slowed down so the progress screen (17) is visible. */
const MOCK_STEP_DELAY_MS = 900;

export default {
  fetch: app.fetch,

  async queue(batch: MessageBatch<JobMessage>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      const job = message.body;
      try {
        switch (job.type) {
          case 'process-offer':
            await processOffer(env, job.offerId, env.MOCK_AI === '1' ? MOCK_STEP_DELAY_MS : 0);
            break;
          default:
            // render-pdf (M6 deploy) and import-price-list (M9) are not implemented yet.
            console.warn('job_not_implemented', job.type);
        }
        message.ack();
      } catch (e) {
        console.error('job_failed', job.type, e instanceof Error ? e.message : 'unknown');
        message.retry();
      }
    }
  },

  async scheduled(controller: ScheduledController, _env: Env): Promise<void> {
    // Reminders and retention arrive in M7/M10.
    console.log('cron', controller.cron);
  },
} satisfies ExportedHandler<Env, JobMessage>;
