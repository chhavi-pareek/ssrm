import requests
import time
import os
from supabase import create_client

CAMUNDA_URL = "http://localhost:8081/engine-rest"
TOPIC = "send_notification"
WORKER_ID = "worker_send_notification"

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

print("🟢 Notification Worker started...")

while True:
    r = requests.post(
        f"{CAMUNDA_URL}/external-task/fetchAndLock",
        json={
            "workerId": WORKER_ID,
            "maxTasks": 1,
            "topics": [{"topicName": TOPIC, "lockDuration": 10000}],
        },
    )

    tasks = r.json()

    for task in tasks:
        task_id = task["id"]
        supplier = task["variables"].get("supplier", {}).get("value", "UNKNOWN")

        print(f"📢 Notification sent for supplier: {supplier}")

        # ✅ WRITE TO SUPABASE
        supabase.table("workflow_events").insert({
            "supplier_id": supplier,
            "event_type": "NOTIFICATION_SENT"
        }).execute()

        # ✅ COMPLETE TASK
        requests.post(
            f"{CAMUNDA_URL}/external-task/{task_id}/complete",
            json={"workerId": WORKER_ID},
        )

    time.sleep(2)

