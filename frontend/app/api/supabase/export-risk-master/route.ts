import { NextRequest, NextResponse } from "next/server";
import { getRiskMasterCsvData } from "@/lib/queries";

function csvEscape(value: unknown) {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(s)) {
    return `"${s.replaceAll('"', '""')}"`;
  }
  return s;
}

function toCsv(rows: Record<string, any>[]) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.map(csvEscape).join(",")];
  for (const r of rows) {
    lines.push(headers.map((h) => csvEscape(r[h])).join(","));
  }
  return lines.join("\n");
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const supplier = searchParams.get("supplier") || "";
    const risk = searchParams.get("risk") || "";
    const industry = searchParams.get("industry") || "";

    const rows = await getRiskMasterCsvData({
      supplierId: supplier && supplier !== "All" ? supplier : undefined,
      riskCategory: risk && risk !== "All" ? risk : undefined,
      industrySegment: industry && industry !== "All" ? industry : undefined
    });

    const csv = toCsv(rows as any);
    const filename = `supplier_risk_master_${new Date().toISOString().replaceAll(":", "-")}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`
      }
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

