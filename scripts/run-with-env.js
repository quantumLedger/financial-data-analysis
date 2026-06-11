/**
 * Load environment from .env and run Next.js (dev or production start).
 *
 * Usage:
 *   node scripts/run-with-env.js dev     # next dev on port 4000
 *   node scripts/run-with-env.js start   # next start on port 4000 (requires build)
 *   node scripts/run-with-env.js build   # next build with .env loaded
 */

const { spawnSync, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const mode = process.argv[2] || "dev";
const envPath = path.join(process.cwd(), ".env");

if (!fs.existsSync(envPath)) {
  console.error("❌ .env not found! Create .env in the project root.");
  process.exit(1);
}

function loadEnvFile(filePath) {
  const envVars = { ...process.env };
  const envContent = fs.readFileSync(filePath, "utf8");

  envContent.split("\n").forEach((line) => {
    line = line.trim();
    if (!line || line.startsWith("#")) return;
    const eq = line.indexOf("=");
    if (eq === -1) return;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) envVars[key] = value;
  });

  return envVars;
}

const envVars = loadEnvFile(envPath);
const port = envVars.PORT || "4000";

function run(command, args, { sync = false } = {}) {
  const childEnv =
    mode === "dev"
      ? { ...envVars, NODE_ENV: "development" }
      : { ...envVars, NODE_ENV: "production" };

  if (sync) {
    const result = spawnSync(command, args, {
      env: childEnv,
      stdio: "inherit",
      shell: true,
    });
    process.exit(result.status ?? 1);
  }

  const child = spawn(command, args, {
    env: childEnv,
    stdio: "inherit",
    shell: true,
  });

  child.on("error", (error) => {
    console.error(`❌ Failed to start:`, error);
    process.exit(1);
  });

  child.on("exit", (code) => {
    process.exit(code || 0);
  });
}

console.log(`✅ Loaded .env (${mode} mode)`);
console.log(`   Port: ${port}`);

if (mode === "dev") {
  console.log(`   Environment: development`);
  console.log(`\n🚀 Starting Next.js dev server...\n`);
  run("npx", ["next", "dev", "-p", port]);
} else if (mode === "build") {
  console.log(`   Environment: production`);
  console.log(`\n🏗️  Building Next.js...\n`);
  run("npx", ["next", "build"], { sync: true });
} else if (mode === "start") {
  console.log(`   Environment: production`);
  console.log(`\n🚀 Starting Next.js production server...\n`);
  run("npx", ["next", "start", "-p", port]);
} else {
  console.error(`❌ Unknown mode "${mode}". Use: dev | build | start`);
  process.exit(1);
}
