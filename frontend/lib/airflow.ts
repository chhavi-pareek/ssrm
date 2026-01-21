import type { NextRequest } from "next/server";

const AIRFLOW_API = process.env.AIRFLOW_API || "http://localhost:8080/api/v1";
const AIRFLOW_USER = process.env.AIRFLOW_USER || "admin";
const AIRFLOW_PASS = process.env.AIRFLOW_PASS || "admin";

export async function triggerPredictionDag(): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> {
  try {
    const url = `${AIRFLOW_API}/dags/srrm_prediction_dag/dagRuns`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${AIRFLOW_USER}:${AIRFLOW_PASS}`).toString("base64")}`
      },
      body: JSON.stringify({
        conf: {
          source: "frontend",
          triggered_at: new Date().toISOString()
        }
      })
    });

    let data: any = {};
    try {
      const text = await response.text();
      if (text) {
        data = JSON.parse(text);
      }
    } catch {
      // Not JSON, ignore
    }

    if (!response.ok) {
      const errorMsg = data?.detail || data?.error || `HTTP ${response.status}`;
      if (errorMsg.includes("No new rows to predict") || errorMsg.includes("no new rows")) {
        return {
          success: true,
          message: "No new rows to predict (INFO: all rows already processed)",
          details: data
        };
      }
      return {
        success: false,
        message: errorMsg,
        details: data
      };
    }

    return {
      success: true,
      message: "Airflow DAG triggered successfully!",
      details: data
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Unknown error",
      details: { error: String(err) }
    };
  }
}
