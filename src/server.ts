import Logger from './core/Logger';
import { port } from './config';
import app from './app';
import { initCache } from './cache';
import { startReminderJob } from './services/reminderJob';
import { startScheduledSendJob } from './services/scheduledSendJob';

console.log('Starting server...');

(async () => {
  await initCache();

  app
    .listen(port, () => {
      Logger.info(`server running on port : ${port}`);
      startReminderJob();
      startScheduledSendJob();
    })
    .on('error', (e) => Logger.error(e));
})();
