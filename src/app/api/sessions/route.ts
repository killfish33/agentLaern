import { z } from "zod";

import { chatRepository } from "@/server/repositories/chat-repository";

const sessionsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(30),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = sessionsQuerySchema.safeParse({
    limit: searchParams.get("limit") ?? "30",
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

  try {
    const sessions = await chatRepository.listSessions(query.data.limit);

    return Response.json({
      ok: true,
      data: sessions.map((session) => ({
        id: session.id,
        title: session.title,
        createdAt: session.createdAt,
        lastMessage: session.messages[0] ?? null,
      })),
    });
  } catch {
    return Response.json(
      {
        ok: false,
        error: "Failed to load sessions",
      },
      { status: 500 },
    );
  }
}
