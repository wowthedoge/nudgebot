import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const STALE_CONVERSATION_HOURS = process.env.STALE_CONVERSATION_HOURS || 24;

export async function getOrCreateUser(phoneNumber) {
  return prisma.user.upsert({
    where: { phoneNumber },
    update: {},
    create: { phoneNumber },
  });
}

export async function saveMessage(userId, role, content) {
  await prisma.message.create({
    data: { userId, role, content },
  });

  return prisma.message.count({
    where: { userId },
  });
}

export async function deleteMessages(userId) {
  await prisma.message.deleteMany({
    where: { userId },
  });
}

export async function getSavedMessages(userId) {
  return prisma.message.findMany({
    where: { userId },
  });
}

export async function updateSummary(userId, text) {
  await prisma.summary.upsert({
    where: { userId },
    update: { text },
    create: { userId, text },
  });
}

export async function getMemory(userId) {
  return await prisma.user.findUnique({
    where: { id: userId },
    include: { messages: true, summary: true },
  });
}

export async function saveScheduledMessage(content, scheduledAt, userId) {
  console.log("saveScheduledMessage", content, scheduledAt, userId);
  return prisma.scheduledMessage.create({
    data: { content, scheduledAt: new Date(scheduledAt), userId },
  });
}

export async function getPendingScheduledMessages() {
  console.log("getPendingScheduledMessages current time", new Date());
  return prisma.scheduledMessage.findMany({
    where: {
      sent: false,
      scheduledAt: {
        lte: new Date(),
      },
    },
    include: {
      user: true,
    },
  }); 
}

export async function markScheduledMessageAsSent(messageId) {
  return prisma.scheduledMessage.update({
    where: { id: messageId },
    data: {
      sent: true,
      sentAt: new Date(),
    },
  });
}

export function updateUserTimezone(userId, timezone) {
  return prisma.user.update({
    where: { id: userId },
    data: { timezone },
  });
}

export async function getStaleConversationUserSummaries() {
  return prisma.user.findMany({
    where: {
      messages: {
        some: {
          createdAt: {
            lte: new Date(new Date().getTime() - STALE_CONVERSATION_HOURS * 60 * 60 * 1000),
          },
        },
      },
    },
    include: {
      summary: true,
      messages: {
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      },
    },
  });
}
