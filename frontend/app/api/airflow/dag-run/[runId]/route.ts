import { NextResponse } from "next/server";

const AIRFLOW_API = process.env.AIRFLOW_API || "http://localhost:8080/api/v1";
const AIRFLOW_USER = process.env.AIRFLOW_USER || "admin";
const AIRFLOW_PASS = process.env.AIRFLOW_PASS || "admin";

export async function GET(
  request: Request,
  context: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await context.params;
    const url = `${AIRFLOW_API}/dags/srrm_prediction_dag/dagRuns/${runId}`;
    
    console.log(`Fetching DAG run status from: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${AIRFLOW_USER}:${AIRFLOW_PASS}`).toString("base64")}`
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`Airflow API error: ${response.status} - ${text}`);
      return NextResponse.json(
        { error: `Failed to fetch DAG run status: ${response.status}`, details: text },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log(`DAG run state: ${data.state}`);
    
    return NextResponse.json({
      success: true,
      data: {
        state: data.state,
        startDate: data.start_date,
        endDate: data.end_date,
        executionDate: data.execution_date,
        runId: data.dag_run_id
      }
    });
  } catch (err) {
    console.error('Error fetching DAG run status:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
