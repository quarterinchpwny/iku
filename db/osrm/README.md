# OSRM

This folder contains the self-hosted OSRM stack used by IKU for commute routing. The setup runs two OSRM profiles:

- driving
- foot

Both profiles sit behind one local Nginx proxy, so the outside world only needs one upstream port.

## Files

- `docker-compose.yml`: separate car and foot preprocess/runtime services plus one proxy
- `.env.example`: runtime variables
- `nginx.conf`: routes driving requests to the car backend and foot requests to the walking backend
- `data/`: input `.osm.pbf` plus generated `car/` and `foot/` datasets

## Setup

1. Copy `.env.example` to `.env`.
2. Put your Philippines extract at `data/philippines.osm.pbf`.
3. Run the preprocess pipeline in sequence. On this host, do not run both prep trees at the same time.

```bash
docker compose --env-file .env --profile prep up --force-recreate osrm-customize-car
docker compose --env-file .env --profile prep up --force-recreate osrm-customize-foot
```

4. Start the runtime stack:

```bash
docker compose --env-file .env up -d osrm-routed-car osrm-routed-foot osrm-proxy
```

5. Test driving and walking through the single proxy port:

```bash
curl 'http://127.0.0.1:5069/health'
curl 'http://127.0.0.1:5069/route/v1/driving/121.0437,14.6760;121.0563,14.5547?overview=false'
curl 'http://127.0.0.1:5069/route/v1/foot/121.0437,14.6760;121.0563,14.5547?overview=false'
```

## Dataset

The current default expects `data/philippines.osm.pbf`. The compose stack symlinks that single source file into `data/car/` and `data/foot/` before preprocessing so each profile gets its own generated `*.osrm*` files.

If you want a different file name, change `OSRM_DATASET` in `.env` so it matches the basename of your `.osm.pbf`.

## Commands

Clean rebuild after replacing the `.osm.pbf`:

```bash
docker compose --env-file .env down
docker compose --env-file .env --profile prep up --force-recreate osrm-customize-car
docker compose --env-file .env --profile prep up --force-recreate osrm-customize-foot
docker compose --env-file .env up -d osrm-routed-car osrm-routed-foot osrm-proxy
```

Stop the server:

```bash
docker compose --env-file .env down
```

Show logs:

```bash
docker compose --env-file .env logs -f osrm-routed-car osrm-routed-foot osrm-proxy
```

## Reverse proxy

Expose only the OSRM proxy service, not the car and foot containers directly.

Expected flow:

```txt
Cloudflare Worker -> osrm-origin.<your-domain> -> reverse proxy -> host:5069 -> osrm-proxy -> car/foot services
```

Important:

- If your outer reverse proxy runs on the host, forwarding to `127.0.0.1:5069` is fine.
- If your outer reverse proxy runs in Docker, do not use `127.0.0.1`. Use the host LAN IP instead.
- The public hostname used by the Worker should be a direct origin host, not a Cloudflare-proxied host.

## Current defaults

`OSRM_PORT` is `5069` in the working setup so the local proxy can sit behind another reverse proxy without exposing the inner OSRM containers directly.
