type StreamChunk = {
  messageId: string;
  seq: number;
  type: "token" | "done";
  token?: string;
};

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const question = searchParams.get("q")?.trim() ?? "";
  const requestId = searchParams.get("requestId")?.trim() || `msg_${Date.now()}`;
  const cursor = Number(searchParams.get("cursor") ?? "0");
  const safeCursor = Number.isFinite(cursor) && cursor > 0 ? Math.floor(cursor) : 0;
  const tokens = buildTokens(question);

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let seq = safeCursor;

      const timer = setInterval(() => {
        if (seq < tokens.length) {
          controller.enqueue(
            toSseData({
              messageId: requestId,
              seq: seq + 1,
              type: "token",
              token: tokens[seq],
            }),
          );
          seq += 1;
          return;
        }

        controller.enqueue(
          toSseData({
            messageId: requestId,
            seq: seq + 1,
            type: "done",
          }),
        );

        clearInterval(timer);
        controller.close();
      }, 180);
    },
    cancel() {},
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
