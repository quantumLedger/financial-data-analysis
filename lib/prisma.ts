import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

// We define the options separately to handle the TS 'never' issue
const prismaOptions: any = {
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
};

// Only add datasourceUrl if we are using the Prisma 7 config approach
if (process.env.DATABASE_URL) {
  prismaOptions.datasourceUrl = process.env.DATABASE_URL;
}

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient(prismaOptions);

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
