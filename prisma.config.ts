import { config } from "dotenv";
// Load .env.local first (takes precedence), then fall back to .env
config({ path: ".env.local" });
config();

import { defineConfig, env } from "@prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
});
