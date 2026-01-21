# SRRM System - Manual Startup Guide

Simple manual startup - run each script in its own terminal window.

## Quick Start

Open **5 separate terminal windows** and run:

### Terminal 1: Airflow Webserver
```bash
cd /Users/chhavipareek/srrm_system
./run_airflow_webserver.sh
```
→ http://localhost:8080

### Terminal 2: Airflow Scheduler
```bash
cd /Users/chhavipareek/srrm_system
./run_airflow_scheduler.sh
```

### Terminal 3: Next.js Frontend
```bash
cd /Users/chhavipareek/srrm_system
./run_frontend.sh
```
→ http://localhost:3000

### Terminal 4: Camunda Platform
```bash
cd /Users/chhavipareek/srrm_system
./run_camunda.sh
```
→ http://localhost:8081/camunda (demo/demo)

### Terminal 5: Camunda Workers
```bash
cd /Users/chhavipareek/srrm_system
./run_workers.sh
```

## Check Status

```bash
./status.sh
```

## Stop Everything

Press `Ctrl+C` in each terminal, or run:
```bash
./stop_all.sh
```

## Notes

- All scripts use the `airflow_venv` virtual environment automatically
- No need to activate venv manually
- Each terminal shows clear output for that specific service
- Frontend auto-installs dependencies if needed
- Camunda reuses existing Docker container if available
