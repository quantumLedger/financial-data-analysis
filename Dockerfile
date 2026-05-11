FROM node:18-alpine

WORKDIR /app

COPY package.json package-lock.json* ./

# Skip postinstall — it calls `dotenv -e .env.prod -- prisma generate` which
# requires a .env.prod file. We generate the Prisma client explicitly below
# using DATABASE_URL from the container environment instead.
RUN npm install --ignore-scripts

COPY . .

# Generate Prisma client from the schema (no DB connection required here).
RUN npx prisma generate

EXPOSE 3001

# `next dev` reads DATABASE_URL and ANTHROPIC_API_KEY from the container env
# directly — no dotenv wrapper needed. Hot-reload is available in dev mode.
CMD ["npx", "next", "dev", "-p", "3001"]
