import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

// Prisma 7（engineType=client）必须传 adapter，这里统一用 pg 适配器。

declare global {
  var __prismaClient__: PrismaClient | undefined;
}

const createPrismaClient = () => {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const adapter = new PrismaPg({ connectionString });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
};

// 开发环境复用全局单例，避免 HMR 下重复创建连接。
export const prisma = globalThis.__prismaClient__ ?? createPrismaClient();
if (process.env.NODE_ENV !== "production") {
  globalThis.__prismaClient__ = prisma;
}
