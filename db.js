import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

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
  })
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
  return prisma.scheduledMessage.create({
    data: { content, scheduledAt, userId },
  });
}

export async function getPendingScheduledMessages() {
  return prisma.scheduledMessage.findMany({
    where: {
      sent: false,
      scheduledAt: {
        lte: new Date(), // Messages scheduled for now or earlier
      },
    },
    include: {
      user: true, // Include user data to get phone number
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
