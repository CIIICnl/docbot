# Use Playwright's official image which includes Chromium and all dependencies
FROM mcr.microsoft.com/playwright:v1.57.0-noble

WORKDIR /app

# Install dependencies (including devDependencies for playwright)
COPY package.json package-lock.json* ./
RUN npm ci

# App source
COPY . .

# Build TypeScript and client
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "dist/server/server.js"]
