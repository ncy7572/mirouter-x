# Mirouter X

A local Xiaomi Mi Router dashboard with SQLite history and fast canvas charts.

## Run

```sh
cp .env.example .env
# edit .env and set MIROUTER_STOK
npm run serve
```

Open `http://127.0.0.1:3102`.

## Notes

- Data is stored in `data/mirouter.sqlite`.
- Retention defaults to 365 days and is controlled by `MIROUTER_RETENTION_DAYS`.
- Polling defaults to every 30 seconds and is controlled by `MIROUTER_POLL_SECONDS`.
- The app intentionally does not persist Wi-Fi passwords returned by sensitive router endpoints.
