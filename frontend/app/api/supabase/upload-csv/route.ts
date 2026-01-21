import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { createSupabaseAdmin } from "@/lib/supabase";

const REQUIRED_COLUMNS = [
  "supplier_id",
  "date",
  "on_time_delivery_rate",
  "quality_score",
  "geopolitical_risk_score",
  "communication_score",
  "annual_spending_rupees",
  "total_risk_score",
  "risk_category",
  "industry_segment",
  "supplier_size"
];

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const text = await file.text();
    const parsed = Papa.parse<Record<string, any>>(text, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false
    });

    const headers = (parsed.meta.fields ?? []).map((h) => String(h).trim());
    const rows = (parsed.data ?? []).filter((r) => r && Object.keys(r).length > 0);

    const missing = REQUIRED_COLUMNS.filter((col) => !headers.includes(col));
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Missing required columns: ${missing.join(", ")}` },
        { status: 400 }
      );
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: "No data rows found" }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();

    const toNum = (v: any) => {
      if (v === null || v === undefined || v === "") return null;
      const n = typeof v === "number" ? v : parseFloat(String(v));
      return Number.isFinite(n) ? n : null;
    };

    const records = rows.map((row) => ({
      supplier_id: row["supplier_id"],
      date: row["date"],
      on_time_delivery_rate: toNum(row["on_time_delivery_rate"]),
      quality_score: toNum(row["quality_score"]),
      geopolitical_risk_score: toNum(row["geopolitical_risk_score"]),
      communication_score: toNum(row["communication_score"]),
      annual_spending_rupees: toNum(row["annual_spending_rupees"]),
      total_risk_score: toNum(row["total_risk_score"]),
      risk_category: row["risk_category"] ?? null,
      industry_segment: row["industry_segment"] ?? null,
      supplier_size: row["supplier_size"] ?? null,
      is_predicted: false
    }));

    const { data, error } = await supabase.from("supplier_risk_master").insert(records).select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, inserted: data?.length ?? rows.length, data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
