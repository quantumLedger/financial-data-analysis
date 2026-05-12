import { config } from "dotenv";
// Load in priority order: .env.local → .env.prod → .env
config({ path: ".env.local" });
config({ path: ".env.prod" });
config();

import { defineConfig, env } from "@prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
});
