import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "agent-fullstack",
    timestamp: new Date().toISOString(),
  });
}
