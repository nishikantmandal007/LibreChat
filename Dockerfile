FROM node:22-bullseye as builder

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 \
  && rm -rf /var/lib/apt/lists/*

COPY package.json ./
COPY package-lock.json ./
COPY client/package.json ./client/
COPY packages/api/package.json ./packages/api/
COPY packages/data-provider/package.json ./packages/data-provider/
COPY packages/data-schemas/package.json ./packages/data-schemas/
COPY packages/client/package.json ./packages/client/

RUN npm install -g npm@11.10.0
RUN npm install

COPY . ./

ARG VITE_BASE_HREF=/
ARG VITE_MDP_API_URL=http://localhost:4000
ENV VITE_BASE_HREF=${VITE_BASE_HREF}
ENV VITE_MDP_API_URL=${VITE_MDP_API_URL}

RUN npm run frontend

FROM nginx:1.25-alpine as runner

COPY --from=builder /app/client/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
