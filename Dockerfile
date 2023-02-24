FROM node:18.14-alpine as builder
WORKDIR '/app'
COPY package.json package-lock.json tsconfig.json ./
RUN npm install
COPY ./src ./src
RUN npm run build

FROM node:18.14-alpine
WORKDIR '/app'
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm install
COPY --from=builder ./app/dist ./
CMD ["npm", "run", "start"]