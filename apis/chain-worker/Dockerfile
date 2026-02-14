FROM oven/bun:1.3.7 as build

WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile --prefer-offline --ignore-scripts
RUN bun --cwd apis/chain-worker run build:bin

FROM gcr.io/distroless/base-debian11
WORKDIR /app
COPY --from=build /app/apis/chain-worker/bin /app/bin

CMD [ "/app/bin/worker" ]
