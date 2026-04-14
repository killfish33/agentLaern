import { z } from "zod";

import { chatRepository } from "@/server/repositories/chat-repository";

const paramsSchema = z.object({
  id: z.string().trim().min(1),
});

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

export async function GET(_request: Request, context: RouteContext) {
  const rawParams = await Promise.resolve(context.params);
  const params = paramsSchema.safeParse(rawParams);

  if (!params.success) {
    return Response.json(
      {
        ok: false,
        error: "Invalid session id",
        details: params.error.issues,
      },
      { status: 400 },
    );
  }

  try {
    const messages = await chatRepository.getSessionMessages(params.data.id);

    return Response.json({
      ok: true,
      data: messages,
    });
  } catch {
    return Response.json(
      {
        ok: false,
        error: "Failed to load messages",
      },
      { status: 500 },
    );
  }
}
