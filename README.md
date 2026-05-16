# Mirouter X

A local Xiaomi Mi Router dashboard with SQLite history and fast canvas charts.

## Run

```sh
cp .env.example .env
# edit .env and set MIROUTER_STOK
npm run serve
```

Open `http://127.0.0.1:3102`.

## Docker

```sh
cp .env.example .env
# edit .env and set MIROUTER_STOK
docker compose up --build -d
```

Open `http://127.0.0.1:3102`.

The Compose file stores SQLite data in the `mirouter-data` volume. To run a
prebuilt image directly, mount `/app/data` and publish port `3102`:

```sh
docker build -t mirouter-x .
docker run -d --name mirouter-x \
  --env-file .env \
  -e HOST=0.0.0.0 \
  -e MIROUTER_DB=/app/data/mirouter.sqlite \
  -p 3102:3102 \
  -v mirouter-data:/app/data \
  mirouter-x
```

## Notes

- Data is stored in `data/mirouter.sqlite`.
- `HOST` controls the bind address. Local runs default to `127.0.0.1`; Docker sets it to `0.0.0.0`.
- Retention defaults to 365 days and is controlled by `MIROUTER_RETENTION_DAYS`.
- Polling defaults to every 30 seconds and is controlled by `MIROUTER_POLL_SECONDS`.
- The app intentionally does not persist Wi-Fi passwords returned by sensitive router endpoints.
