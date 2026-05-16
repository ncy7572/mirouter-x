# Mirouter X

A local Xiaomi Mi Router dashboard with SQLite history and fast canvas charts.

## Run

```sh
cp .env.example .env
# edit .env and set MIROUTER_PASSWORD, or set MIROUTER_STOK as a manual fallback
npm run serve
```

Open `http://127.0.0.1:3102`, or set `PORT` in `.env` for a different local port.

## Docker

```sh
cp .env.example .env
# edit .env and set MIROUTER_PASSWORD, or set MIROUTER_STOK as a manual fallback
docker compose up --build -d
```

Open `http://127.0.0.1:3102`, or set `HOST_PORT` in `.env` to publish a different host port.

The Compose file stores SQLite data in the host `./data` directory. To run a
prebuilt image directly, mount `/app/data` and publish port `3102`:

```sh
docker build -t mirouter-x .
docker run -d --name mirouter-x \
  --env-file .env \
  -e HOST=0.0.0.0 \
  -e MIROUTER_DB=/app/data/mirouter.sqlite \
  -p 3102:3102 \
  -v "$PWD/data:/app/data" \
  mirouter-x
```

## Notes

- Data is stored in `data/mirouter.sqlite`.
- `MIROUTER_PASSWORD` enables automatic Xiaomi router login and token refresh. `MIROUTER_STOK` is still supported as a manual fallback.
- `MIROUTER_NONCE_DEVICE_ID` and `MIROUTER_AUTH_KEY` tune the login hash for firmware variants; the default hash key matches the common MiWiFi auth flow, and the device id is generated automatically when omitted.
- `HOST` controls the bind address. Local runs default to `127.0.0.1`; Docker sets it to `0.0.0.0`.
- `HOST_PORT` controls the Docker host port. `PORT` remains the app's internal container port.
- Retention defaults to 365 days and is controlled by `MIROUTER_RETENTION_DAYS`.
- Polling defaults to every 30 seconds and is controlled by `MIROUTER_POLL_SECONDS`.
- The app intentionally does not persist Wi-Fi passwords returned by sensitive router endpoints.
