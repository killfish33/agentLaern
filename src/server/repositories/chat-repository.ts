import { prisma } from "@/server/prisma/client";

type EnsureSessionInput = {
  sessionId?: string;
  title?: string;
  userId?: string;
};

type CreateMessageInput = {
  id?: string;
  sessionId: string;
  role: "user" | "assistant" | "system";
  content: string;
  status?: "pending" | "streaming" | "done" | "error";
  seq?: number;
};

export const chatRepository = {
  // 若前端传了 sessionId 且已存在，则复用；否则创建新会话。
  async ensureSession(input: EnsureSessionInput) {
    if (input.sessionId) {
      const existing = await prisma.session.findUnique({
        where: { id: input.sessionId },
      });

      if (existing) {
        return existing;
      }
    }

    return prisma.session.create({
      data: {
        id: input.sessionId,
        title: input.title,
        userId: input.userId,
      },
    });
  },

  // 统一消息写入入口，约束 role/status/seq 写法。
  async createMessage(input: CreateMessageInput) {
    return prisma.message.create({
      data: {
        id: input.id,
        sessionId: input.sessionId,
        role: input.role,
        content: input.content,
        status: input.status ?? "pending",
        seq: input.seq,
      },
    });
  },

  // 流式过程中按 messageId 增量更新内容，并推进状态。
  async updateMessageContent(
    messageId: string,
    content: string,
    status: "streaming" | "done" | "error",
  ) {
    return prisma.message.update({
      where: { id: messageId },
      data: {
        content,
        status,
      },
    });
  },

  async listSessions(limit = 30) {
    return prisma.session.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        messages: {
          take: 1,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            role: true,
            content: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });
  },

  // 历史消息：按时间正序返回，前端可直接顺序渲染。
  async getSessionMessages(sessionId: string) {
    return prisma.message.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
    });
  },
};
