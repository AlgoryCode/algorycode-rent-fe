import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Next.js .env.local + isteğe bağlı .env
config({ path: ".env.local" });
config();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Runtime / pooler (6543). Migrate & db pull için: npm run db:prisma:pull (DIRECT_URL kullanır)
    url: process.env.DATABASE_URL,
  },
});
