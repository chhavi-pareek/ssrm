import { NextResponse } from "next/server";
import { triggerPredictionDag } from "@/lib/airflow";

export async function POST() {
  try {
    const result = await triggerPredictionDag();
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
        details: result.details
      });
    } else {
      return NextResponse.json(
        { error: result.message, details: result.details },
        { status: 500 }
      );
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
