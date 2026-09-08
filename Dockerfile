# limitless-web auf Railway.
#
# Zwei Stufen, damit das Laufzeit-Abbild klein bleibt: erst bauen (dort werden
# die Dev-Abhängigkeiten für Vite gebraucht), dann nur das Nötige übernehmen.
#
# `sharp` liefert vorgebaute Binärdateien für linux/glibc — deshalb `slim` und
# nicht `alpine`. Auf Alpine (musl) müsste sharp aus dem Quelltext gebaut
# werden, was den Build unnötig lang und fehleranfällig macht.

FROM node:20-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Nur Laufzeit-Abhängigkeiten. `--omit=dev` lässt Vite, TypeScript und
# Puppeteer draußen — die werden im Betrieb nicht gebraucht.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY api ./api
COPY public ./public
COPY server.mjs vercel.json ./

# Railway setzt PORT selbst; 3000 ist nur der Rückfallwert für lokale Läufe.
ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.mjs"]
