FROM node:18.14-alpine as builder
WORKDIR '/app'
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci
COPY ./src ./src
RUN npm run build

FROM node:18.14-alpine
WORKDIR '/app'
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --production && npm cache clean --force
COPY --from=builder ./app/dist ./
CMD ["node", "./app.js"]