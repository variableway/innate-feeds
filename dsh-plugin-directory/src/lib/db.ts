import { PrismaPg } from "@prisma/adapter-pg"

import { PrismaClient } from "@/generated/prisma/client"

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    // The local Prisma dev Postgres terminates connections under parallel
    // load (P1017); a single pooled connection per process is stable.
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 1 }),
  })

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db
