# ---- Fase de Build ----
# Usamos uma imagem Node.js completa para ter todas as ferramentas de build
FROM node:20-alpine AS builder

# Define o diretório de trabalho dentro do container
WORKDIR /app

# Copia os ficheiros de definição de pacotes
COPY package.json package-lock.json ./

# Instala as dependências de produção e desenvolvimento
# Usamos 'npm ci' para uma instalação limpa e determinística, ideal para CI/CD
RUN npm ci

# Copia o resto do código fonte da aplicação
COPY . .

# Compila o código TypeScript para JavaScript
RUN npm run build

# Remove as dependências de desenvolvimento para a fase de produção
RUN npm prune --production


# ---- Fase de Produção ----
# Usamos uma imagem base leve para a produção
FROM node:20-alpine AS production

# Define o diretório de trabalho
WORKDIR /app

# Install tzdata to allow timezone changes
RUN apk add --no-cache tzdata

# Set default timezone, can be overridden by docker run -e TZ=...
ENV TZ=UTC

# Cria um utilizador e grupo não-root para correr a aplicação por razões de segurança
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copia as dependências de produção da fase de build
COPY --from=builder /app/node_modules ./node_modules

# Copia os ficheiros de definição de pacotes
COPY --from=builder /app/package.json ./package.json

# Copia o código compilado da fase de build
COPY --from=builder /app/build ./build

# Muda a propriedade dos ficheiros para o nosso utilizador não-root
RUN chown -R appuser:appgroup /app

# Muda para o utilizador não-root
USER appuser

# Expõe a porta em que a aplicação corre
EXPOSE 3000

# Define o comando para iniciar a aplicação
# TRANSPORT_MODE é crucial para o nosso servidor correr em modo HTTP
CMD ["node", "build/index.js"] 