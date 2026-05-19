# Mirouter X

A local Xiaomi Mi Router dashboard with SQLite history and fast canvas charts.

## Run

```sh
cp .env.example .env
# edit .env and set MIROUTER_PASSWORD
npm run serve
```

Open `http://127.0.0.1:3000` with the example `.env`, or set `PORT` for a different port. Without an `.env`, the app falls back to port `3102`.

## Docker

```sh
cp .env.example .env
# edit .env and set MIROUTER_PASSWORD
docker compose up --build -d
```

Open `http://127.0.0.1:3000` with the example `.env`, or set `PORT` for a different port. Without an `.env`, Compose falls back to port `3102`.

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

## Configuration

| Variable | Default | Description |
|---|---|---|
| `MIROUTER_HOST` | `192.168.31.1` | Router IP address |
| `MIROUTER_PASSWORD` | — | Router admin password (required) |
| `MIROUTER_NONCE_DEVICE_ID` | auto | Login hash device ID for firmware variants |
| `MIROUTER_AUTH_KEY` | MiWiFi default | Login hash key for firmware variants |
| `MIROUTER_POLL_SECONDS` | `30` | Collection interval in seconds (min 1) |
| `MIROUTER_RETENTION_DET_DAYS` | `7` | Days to keep raw + 1-minute rollup data |
| `MIROUTER_RETENTION_AGG_DAYS` | `365` | Days to keep 1-hour and 1-day rollup data |
| `MIROUTER_LOG_SUMMARY_MINUTES` | `10` | API call summary log interval; `0` to disable |
| `PORT` | `3102` | HTTP listen port |
| `HOST` | `127.0.0.1` | HTTP bind address (`0.0.0.0` for Docker) |
| `MIROUTER_DB` | `./data/mirouter.sqlite` | SQLite database path |

- `MIROUTER_PASSWORD` is required. The app logs into the Xiaomi router on startup to obtain and refresh the session token.
- `MIROUTER_NONCE_DEVICE_ID` and `MIROUTER_AUTH_KEY` tune the login hash for firmware variants; the defaults match the current MiWiFi auth flow and the device ID is generated automatically when omitted.
- The app intentionally does not persist Wi-Fi passwords returned by sensitive router endpoints.

## Chart time ranges

The dashboard offers preset time ranges and full custom range selection. A background rollup job aggregates raw samples every minute into pre-computed tables used for longer views.

### Preset ranges

| Range | Data tier | Bucket | Min points to enable |
|---|---|---|---|
| 15m | raw samples | per poll | always enabled |
| 1h | 1-minute rollup | 1 min | 30 |
| 1d | 1-minute rollup | 1 min | 30 |
| 7d | 1-hour rollup | 1 hour | 24 |
| 30d | 1-day rollup | 1 day | 15 |

Preset buttons that do not yet have enough collected data are disabled and show a tooltip with the current and required point counts.

### Tier fallback

If the natural rollup tier for a range has fewer than 10 data points, the query automatically falls back to the next finer tier and re-aggregates into the expected bucket size. The cascade is: `1d → 1h → 1m`. Aggregation uses AVG of averages, MIN of minimums, MAX of maximums, and SUM of bytes so the shaded min/max band and totals remain accurate.

### Custom range and zoom

- **Drag** left-to-right on the chart canvas to zoom into that exact time window. Repeat to zoom further.
- The **↩ Zoom out** button appears in the toolbar whenever you are inside a zoom chain. Each click steps back one level; the full zoom history is preserved so multiple levels of zoom can be unwound one at a time.
- The **Time range** preset button opens date/time pickers for an arbitrary fixed window. Applying a manual range clears the zoom history.

### Fixed range mode

When a custom range is active the dashboard enters fixed range mode:

- The chart and client usage data are frozen to the selected time period and do not update during auto-refresh (only the live stat cards at the top refresh).
- The client list order and accumulated usage reflect the selected period and do not change.
- The Latest / Accumulated toggle is disabled; the client list always shows accumulated usage for the fixed period.
- If the selected window is older than `MIROUTER_RETENTION_DET_DAYS` and falls in the raw or 1-minute tier, the chart shows a hint explaining that detail data has been cleaned.

## Data retention

Mirouter X keeps two classes of data with separate retention windows:

- **Detail data** — raw samples (`samples`, `client_samples`) and 1-minute rollups. Retained for `MIROUTER_RETENTION_DET_DAYS` (default 7 days). Zooming into a window older than this limit in the raw or 1-minute tier will show no data; the chart displays a message indicating the retention setting.
- **Aggregated data** — 1-hour and 1-day rollups. Retained for `MIROUTER_RETENTION_AGG_DAYS` (default 365 days). Longer views (7d, 30d) continue to work across the full aggregated retention window even after detail data is cleaned.

## Database and Performance

Mirouter X stores one router row per poll in `samples` and one row per visible device per poll in `client_samples`. SQLite runs in WAL mode with `synchronous=NORMAL`, so short writes are cheap, but high-frequency collection grows the database linearly:

```text
client sample rows per day = 86400 / MIROUTER_POLL_SECONDS * device count
```

At `MIROUTER_POLL_SECONDS=1` and 500 devices, that is 43.2 million client rows per day. A local synthetic benchmark on this project wrote 900,000 client rows, equivalent to 500 devices for 30 minutes, in about 11 seconds on a desktop Mac and used about 109 MiB of SQLite pages. Extrapolated raw storage is roughly 5 GB/day before filesystem and vacuum effects.

The background rollup job runs every minute and condenses raw second-level samples into `samples_1m`, `samples_1h`, and `samples_1d` (and corresponding `client_samples_*` tables). Longer chart views query these compact tables rather than raw samples, keeping query time proportional to the number of buckets rather than the number of collected rows.

Raspberry Pi guidance:

- A Pi can usually keep up with the write rate for 1-second polling and 500 devices if the database is on a good SSD.
- A microSD card is not recommended for that load because of write volume and long-term wear.
- For Raspberry Pi use, prefer the default 30-second polling for long retention, or keep retention short when using 1-second polling. For example, 1-second polling with 500 devices is reasonable for short diagnostics, not for year-long history on Pi storage.
- With the default 7-day detail retention and 365-day aggregated retention, the database size stays manageable on Pi: raw data is pruned weekly, and only the compact hourly/daily rollups accumulate long-term.
