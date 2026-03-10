import Logger from './core/Logger';
import { port } from './config';
import app from './app';
import { startReminderJob } from './services/reminderJob';

console.log('Starting server...');

app
  .listen(port, () => {
    Logger.info(`server running on port : ${port}`);
    startReminderJob();
  })
  .on('error', (e) => Logger.error(e));
