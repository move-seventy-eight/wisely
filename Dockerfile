# ==============================================================================
# Wisely - Production Multi-Stage Dockerfile
# ==============================================================================

# 1. Aşama: Bağımlılıkların Yüklenmesi
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma ./prisma/
RUN npm ci

# 2. Aşama: Derleme (Builder)
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Prisma Client üretimi ve Next.js optimize production derlemesi
RUN npx prisma generate
RUN npm run build

# 3. Aşama: Çalışma Zamanı (Runner)
FROM node:22-alpine AS runner
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1

# Güvenlik için non-root kullanıcı oluşturulması
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Kalıcı veri dizini oluşturulması ve izin verilmesi
RUN mkdir -p /app/prisma /app/.promptfoo && \
    chown -R nextjs:nodejs /app

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts

USER nextjs

EXPOSE 3000
EXPOSE 15500

# Wisely ve Promptfoo arka plan servislerini eşzamanlı production modunda başlatır
CMD ["npm", "run", "start:prod"]
