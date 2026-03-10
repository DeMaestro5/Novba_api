import prisma from '../index';

export interface ReminderSettingsData {
  enabled?: boolean;
  beforeDueDays?: number[];
  afterDueDays?: number[];
  userConfigured?: boolean;
}

async function findByUserId(userId: string) {
  return prisma.reminderSettings.findUnique({
    where: { userId },
  });
}

async function upsert(userId: string, data: ReminderSettingsData) {
  return prisma.reminderSettings.upsert({
    where: { userId },
    create: {
      userId,
      enabled: data.enabled ?? true,
      beforeDueDays: data.beforeDueDays ?? [3, 7],
      afterDueDays: data.afterDueDays ?? [1, 7, 14],
      userConfigured: data.userConfigured ?? false,
    },
    update: {
      ...(data.enabled !== undefined && { enabled: data.enabled }),
      ...(data.beforeDueDays !== undefined && { beforeDueDays: data.beforeDueDays }),
      ...(data.afterDueDays !== undefined && { afterDueDays: data.afterDueDays }),
      ...(data.userConfigured !== undefined && { userConfigured: data.userConfigured }),
      updatedAt: new Date(),
    },
  });
}

// Used by the cron job — fetches all users with reminders enabled
async function findAllEnabled() {
  return prisma.reminderSettings.findMany({
    where: { enabled: true },
    select: {
      userId: true,
      beforeDueDays: true,
      afterDueDays: true,
      userConfigured: true,
    },
  });
}

export default { findByUserId, upsert, findAllEnabled };
