import { PrismaClient } from "@/generated/prisma/client";
import { generateId } from "@/lib/id-generator";

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

function createPrismaClient() {
  return new PrismaClient().$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (operation === "create" && model && args.data) {
            const data = args.data as Record<string, unknown>
            if (!data.id) {
              data.id = generateId(model)
            }
          }
          return query(args)
        }
      }
    }
  })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
