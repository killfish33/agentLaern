import { z } from "zod";

import { chatRepository } from "@/server/repositories/chat-repository";

type StreamChunk = {
  messageId: string;
  sessionId: string;
  seq: number;
  type: "token" | "done";
  token?: string;
};

// 流式接口 query 参数校验：保证重连时 cursor/sessionId 可用。
const streamQuerySchema = z.object({
  q: z.string().trim().default(""),
  requestId: z.string().trim().min(1).optional(),
  sessionId: z.string().trim().min(1).optional(),
  cursor: z.coerce.number().int().nonnegative().default(0),
});

const encoder = new TextEncoder();

function toSseData(data: StreamChunk) {
  return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
}

function buildTokens(question: string) {
  const baseText = question
    ? `收到你的问题：${question}。这是 SSE Mock 的流式回答。`
    : "你好，这是一个 SSE Mock 流。";

  return Array.from(baseText);
}

function buildSessionTitle(question: string) {
  return question ? question.slice(0, 32) : "新会话";
}

function createUserMessageId() {
  return `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = streamQuerySchema.safeParse({
    q: searchParams.get("q") ?? "",
    requestId: searchParams.get("requestId") ?? undefined,
    sessionId: searchParams.get("sessionId") ?? undefined,
    cursor: searchParams.get("cursor") ?? "0",
  });

  if (!query.success) {
    return Response.json(
      {
        ok: false,
        error: "Invalid query",
        details: query.error.issues,
      },
      { status: 400 },
    );
  }

  const question = query.data.q;
  const requestId = query.data.requestId || `assistant_${Date.now()}`;
  const safeCursor = query.data.cursor;
  const tokens = buildTokens(question);

  // 先确保会话存在，再进行消息写入，保证同一请求的数据归属一致。
  const session = await chatRepository.ensureSession({
    sessionId: query.data.sessionId,
    title: buildSessionTitle(question),
  });

  await chatRepository.createMessage({
    id: createUserMessageId(),
    sessionId: session.id,
    role: "user",
    content: question,
    status: "done",
  });

  // assistant 消息先写入 pending，占位后再在流式过程中持续更新。
  await chatRepository.createMessage({
    id: requestId,
    sessionId: session.id,
    role: "assistant",
    content: "",
    status: "pending",
  });

  let seq = safeCursor;
  let assistantContent = "";
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const cleanup = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // pump 负责逐 token 推送并把增量内容同步落库。
      const pump = async () => {
        if (cancelled) {
          cleanup();
          return;
        }

        try {
          if (seq < tokens.length) {
            const token = tokens[seq];
            assistantContent += token;

            controller.enqueue(
              toSseData({
                messageId: requestId,
                sessionId: session.id,
                seq: seq + 1,
                type: "token",
                token,
              }),
            );

            await chatRepository.updateMessageContent(
              requestId,
              assistantContent,
              "streaming",
            );

            seq += 1;
            timer = setTimeout(() => {
              void pump();
            }, 180);
            return;
          }

          controller.enqueue(
            toSseData({
              messageId: requestId,
              sessionId: session.id,
              seq: seq + 1,
              type: "done",
            }),
          );

          await chatRepository.updateMessageContent(
            requestId,
            assistantContent || "（空响应）",
            "done",
          );

          cleanup();
          controller.close();
        } catch {
          await chatRepository.updateMessageContent(
            requestId,
            assistantContent || "请求失败，请重试。",
            "error",
          );

          cleanup();
          controller.error(new Error("stream failed"));
        }
      };

      void pump();
    },
    cancel() {
      cancelled = true;
      cleanup();
      void chatRepository.updateMessageContent(
        requestId,
        assistantContent || "请求已取消",
        "error",
      );
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
