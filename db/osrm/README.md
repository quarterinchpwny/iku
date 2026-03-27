# OSRM

This folder contains the local OSRM stack for the repo.

## Files

- `docker-compose.yml`: separate car and foot preprocess/runtime services plus one proxy
- `.env.example`: runtime variables
- `nginx.conf`: routes driving requests to the car backend and foot requests to the walking backend
- `data/`: input `.osm.pbf` plus generated `car/` and `foot/` datasets

## Setup

1. Copy `.env.example` to `.env`.
2. Put your Philippines extract at `data/philippines.osm.pbf`.
3. Run the preprocess pipeline for both profiles:

```bash
docker compose --env-file .env --profile prep up osrm-extract-car osrm-partition-car osrm-customize-car osrm-extract-foot osrm-partition-foot osrm-customize-foot
```

4. Start the runtime stack:

```bash
docker compose --env-file .env up -d osrm-routed-car osrm-routed-foot osrm-proxy
```

5. Test driving and walking through the single proxy port:

```bash
curl 'http://127.0.0.1:5000/route/v1/driving/121.0437,14.6760;121.0563,14.5547?overview=false'
curl 'http://127.0.0.1:5000/route/v1/foot/121.0437,14.6760;121.0563,14.5547?overview=false'
```

## Dataset

The current default expects `data/philippines.osm.pbf`. The compose stack symlinks that single source file into `data/car/` and `data/foot/` before preprocessing so each profile gets its own generated `*.osrm*` files.

If you want a different file name, change `OSRM_DATASET` in `.env` so it matches the basename of your `.osm.pbf`.

## Commands

Rebuild after replacing the `.osm.pbf`:

```bash
docker compose --env-file .env --profile prep up --force-recreate osrm-extract-car osrm-partition-car osrm-customize-car osrm-extract-foot osrm-partition-foot osrm-customize-foot
```

Stop the server:

```bash
docker compose --env-file .env down
```

Show logs:

```bash
docker compose --env-file .env logs -f osrm-routed-car osrm-routed-foot osrm-proxy
```
