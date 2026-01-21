import { NextResponse } from "next/server";

const AIRFLOW_API = process.env.AIRFLOW_API || "http://localhost:8080/api/v1";
const AIRFLOW_USER = process.env.AIRFLOW_USER || "admin";
const AIRFLOW_PASS = process.env.AIRFLOW_PASS || "admin";

export async function GET() {
  try {
    const resp = await fetch(`${AIRFLOW_API}/health`, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${AIRFLOW_USER}:${AIRFLOW_PASS}`).toString("base64")}`
      }
    });

    const text = await resp.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    return NextResponse.json({
      ok: resp.ok,
      status: resp.status,
      body: json ?? text
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

