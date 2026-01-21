import { createSupabaseAdmin } from "@/lib/supabase";
import type {
  RiskPredictionHistoryRow,
  ShapExplanationsRow,
  SupplierRiskMasterRow,
  SupplierProfile,
  WorkflowEventRow
} from "@/types/db";

export type LatestPrediction = RiskPredictionHistoryRow & {
  supplier_name?: string;
};

export type ExecutiveOverview = {
  latestPredictions: LatestPrediction[];
  riskCounts: { High: number; Medium: number; Low: number; Unknown: number };
  avgProbHigh: number | null;
  topHighRisk: LatestPrediction[]; // Top 10, sorted by prob_high DESC
  totalSuppliers: number; // distinct supplier_id from supplier_risk_master (Streamlit)
  totalPredictions: number; // raw row count from risk_prediction_history (Streamlit)
};

export async function getSupplierProfiles(): Promise<SupplierProfile[]> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("supplier_profile")
    .select("supplier_id,supplier_name,country,established_year,primary_contact_email")
    .order("supplier_name", { ascending: true });

  if (error) throw new Error(`Failed to fetch supplier_profile: ${error.message}`);
  return (data ?? []) as SupplierProfile[];
}

export async function getTotalSuppliers(): Promise<number> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase.from("supplier_risk_master").select("supplier_id");
  if (error) throw new Error(`Failed to fetch supplier_risk_master for supplier count: ${error.message}`);
  const ids = new Set<string>();
  for (const row of data ?? []) {
    const id = (row as any)?.supplier_id;
    if (typeof id === "string") ids.add(id);
  }
  return ids.size;
}

export async function getTotalPredictions(): Promise<number> {
  const supabase = createSupabaseAdmin();
  const { count, error } = await supabase
    .from("risk_prediction_history")
    .select("*", { count: "exact", head: true });
  if (error) throw new Error(`Failed to count predictions: ${error.message}`);
  return count ?? 0;
}

/**
 * Latest prediction per supplier (computed safely by ordering and reducing).
 * This enforces the rule:
 * SELECT DISTINCT ON (supplier_id) * FROM risk_prediction_history ORDER BY supplier_id, prediction_date DESC;
 */
export async function getLatestPredictionsPerSupplier(): Promise<RiskPredictionHistoryRow[]> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("risk_prediction_history")
    .select("*")
    .order("supplier_id", { ascending: true })
    .order("prediction_date", { ascending: false });

  if (error) throw new Error(`Failed to fetch risk_prediction_history: ${error.message}`);

  const rows = (data ?? []) as RiskPredictionHistoryRow[];
  const latestBySupplier = new Map<string, RiskPredictionHistoryRow>();
  for (const r of rows) {
    if (!latestBySupplier.has(r.supplier_id)) {
      latestBySupplier.set(r.supplier_id, r);
    }
  }
  return Array.from(latestBySupplier.values());
}

function normalizeRiskLabel(label: string | null | undefined) {
  return (label ?? "").toLowerCase().replaceAll("_", " ").trim();
}

export async function getExecutiveOverview(): Promise<ExecutiveOverview> {
  const supabase = createSupabaseAdmin();
  const [profiles, latestPredictions, allPredictions, totalSuppliers, totalPredictions] = await Promise.all([
    getSupplierProfiles(),
    getLatestPredictionsPerSupplier(),
    supabase.from("risk_prediction_history").select("*").then(({ data, error }) => {
      if (error) throw new Error(`Failed to fetch all predictions: ${error.message}`);
      return (data ?? []) as RiskPredictionHistoryRow[];
    }),
    getTotalSuppliers(),
    getTotalPredictions()
  ]);

  const nameById = new Map(profiles.map((p) => [p.supplier_id, p.supplier_name]));
  const latestWithNames: LatestPrediction[] = latestPredictions.map((p) => ({
    ...p,
    supplier_name: nameById.get(p.supplier_id)
  }));

  // Count suppliers by MAJORITY prediction across all history
  // For each supplier, count their High/Medium/Low predictions and assign to the majority category
  const supplierRiskCounts = new Map<string, { high: number; medium: number; low: number; unknown: number }>();
  
  for (const p of allPredictions) {
    if (!supplierRiskCounts.has(p.supplier_id)) {
      supplierRiskCounts.set(p.supplier_id, { high: 0, medium: 0, low: 0, unknown: 0 });
    }
    const counts = supplierRiskCounts.get(p.supplier_id)!;
    const r = normalizeRiskLabel(p.predicted_risk);
    if (r === "high risk" || r === "high") counts.high += 1;
    else if (r === "medium risk" || r === "medium") counts.medium += 1;
    else if (r === "low risk" || r === "low") counts.low += 1;
    else counts.unknown += 1;
  }

  // Now assign each supplier to their majority risk category
  const riskCounts = { High: 0, Medium: 0, Low: 0, Unknown: 0 };
  for (const [supplierId, counts] of supplierRiskCounts) {
    const max = Math.max(counts.high, counts.medium, counts.low, counts.unknown);
    if (counts.high === max) riskCounts.High += 1;
    else if (counts.medium === max) riskCounts.Medium += 1;
    else if (counts.low === max) riskCounts.Low += 1;
    else riskCounts.Unknown += 1;
  }

  // Average prob_high from ALL predictions
  const avgProbHigh =
    allPredictions.length === 0
      ? null
      : allPredictions.reduce((sum, r) => sum + (r.prob_high ?? 0), 0) / allPredictions.length;

  // Top high risk from ALL predictions with supplier names
  const allWithNames: LatestPrediction[] = allPredictions.map((p) => ({
    ...p,
    supplier_name: nameById.get(p.supplier_id)
  }));
  const topHighRisk = [...allWithNames]
    .sort((a, b) => (b.prob_high ?? 0) - (a.prob_high ?? 0))
    .slice(0, 10);

  return {
    latestPredictions: latestWithNames,
    riskCounts,
    avgProbHigh,
    topHighRisk,
    totalSuppliers,
    totalPredictions
  };
}

export async function getAllPredictions(args: {
  sortBy: "prediction_date" | "prob_high" | "prob_medium" | "prob_low";
  ascending: boolean;
}): Promise<RiskPredictionHistoryRow[]> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("risk_prediction_history")
    .select("*")
    .order(args.sortBy, { ascending: args.ascending });
  if (error) throw new Error(`Failed to fetch predictions: ${error.message}`);
  return (data ?? []) as RiskPredictionHistoryRow[];
}

export type RiskMasterFilterOptions = {
  supplierIds: string[];
  riskCategories: string[];
  industrySegments: string[];
  totalRows: number;
};

export async function getRiskMasterFilterOptions(): Promise<RiskMasterFilterOptions> {
  const supabase = createSupabaseAdmin();
  const { data, error, count } = await supabase
    .from("supplier_risk_master")
    .select("supplier_id,risk_category,industry_segment", { count: "exact" })
    .order("date", { ascending: false });
  if (error) throw new Error(`Failed to fetch supplier_risk_master filter options: ${error.message}`);

  const supplierIds = new Set<string>();
  const riskCategories = new Set<string>();
  const industrySegments = new Set<string>();

  for (const row of data ?? []) {
    const sid = (row as any)?.supplier_id;
    const rc = (row as any)?.risk_category;
    const iseg = (row as any)?.industry_segment;
    if (typeof sid === "string") supplierIds.add(sid);
    if (typeof rc === "string" && rc.trim()) riskCategories.add(rc);
    if (typeof iseg === "string" && iseg.trim()) industrySegments.add(iseg);
  }

  return {
    supplierIds: ["All", ...Array.from(supplierIds).sort()],
    riskCategories: ["All", ...Array.from(riskCategories).sort()],
    industrySegments: ["All", ...Array.from(industrySegments).sort()],
    totalRows: count ?? (data?.length ?? 0)
  };
}

export async function getRiskMasterCsvData(args: {
  supplierId?: string;
  riskCategory?: string;
  industrySegment?: string;
}): Promise<SupplierRiskMasterRow[]> {
  const supabase = createSupabaseAdmin();
  let q = supabase.from("supplier_risk_master").select("*").order("date", { ascending: false });
  if (args.supplierId) q = q.eq("supplier_id", args.supplierId);
  if (args.riskCategory) q = q.eq("risk_category", args.riskCategory);
  if (args.industrySegment) q = q.eq("industry_segment", args.industrySegment);
  const { data, error } = await q;
  if (error) throw new Error(`Failed to fetch supplier_risk_master export: ${error.message}`);
  return (data ?? []) as SupplierRiskMasterRow[];
}

export async function getShapSupplierIds(): Promise<string[]> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("shap_explanations")
    .select("supplier_id")
    .order("supplier_id", { ascending: true });
  if (error) throw new Error(`Failed to fetch SHAP supplier IDs: ${error.message}`);
  const ids = new Set<string>();
  for (const row of data ?? []) {
    const sid = (row as any)?.supplier_id;
    if (typeof sid === "string") ids.add(sid);
  }
  return Array.from(ids).sort();
}

export async function getLatestShapForSupplier(supplierId: string): Promise<{
  supplier_id: string;
  prediction_date: string;
  shap_values: Record<string, number>;
} | null> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("shap_explanations")
    .select("supplier_id,prediction_date,shap_values")
    .eq("supplier_id", supplierId)
    .order("prediction_date", { ascending: false })
    .limit(1);
  if (error) throw new Error(`Failed to fetch latest SHAP: ${error.message}`);
  const row = (data?.[0] ?? null) as ShapExplanationsRow | null;
  if (!row) return null;
  return {
    supplier_id: row.supplier_id,
    prediction_date: row.prediction_date,
    shap_values: parseShapValues(row.shap_values)
  };
}

export type PredictionHistoryPage = {
  rows: RiskPredictionHistoryRow[];
  total: number;
  page: number;
  pageSize: number;
};

export async function getPredictionHistoryPage(args: {
  page: number;
  pageSize: number;
  supplierId?: string;
}): Promise<PredictionHistoryPage> {
  const supabase = createSupabaseAdmin();
  const page = Math.max(1, args.page);
  const pageSize = Math.min(100, Math.max(5, args.pageSize));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabase
    .from("risk_prediction_history")
    .select("supplier_id,prediction_date,predicted_risk,prob_high,prob_medium,prob_low,model_version", {
      count: "exact"
    })
    .order("prediction_date", { ascending: false })
    .range(from, to);

  if (args.supplierId) q = q.eq("supplier_id", args.supplierId);

  const { data, error, count } = await q;
  if (error) throw new Error(`Failed to fetch prediction history: ${error.message}`);

  return {
    rows: (data ?? []) as RiskPredictionHistoryRow[],
    total: count ?? 0,
    page,
    pageSize
  };
}

export type RiskMasterPage = {
  rows: SupplierRiskMasterRow[];
  total: number;
  page: number;
  pageSize: number;
};

export async function getRiskMasterPage(args: {
  page: number;
  pageSize: number;
  supplierId?: string;
  industry?: string;
  riskCategory?: string;
  fromDate?: string;
  toDate?: string;
}): Promise<RiskMasterPage> {
  const supabase = createSupabaseAdmin();
  const page = Math.max(1, args.page);
  const pageSize = Math.min(200, Math.max(10, args.pageSize));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabase
    .from("supplier_risk_master")
    .select(
      "supplier_id,date,on_time_delivery_rate,quality_score,geopolitical_risk_score,communication_score,annual_spending_rupees,total_risk_score,risk_category,industry_segment,supplier_size,is_predicted",
      { count: "exact" }
    )
    .order("date", { ascending: false })
    .range(from, to);

  if (args.supplierId) q = q.eq("supplier_id", args.supplierId);
  if (args.industry) q = q.eq("industry_segment", args.industry);
  if (args.riskCategory) q = q.eq("risk_category", args.riskCategory);
  if (args.fromDate) q = q.gte("date", args.fromDate);
  if (args.toDate) q = q.lte("date", args.toDate);

  const { data, error, count } = await q;
  if (error) throw new Error(`Failed to fetch supplier_risk_master: ${error.message}`);

  return {
    rows: (data ?? []) as SupplierRiskMasterRow[],
    total: count ?? 0,
    page,
    pageSize
  };
}

export type ShapSummary = {
  supplier_id: string;
  supplier_name: string | null;
  prediction_date: string;
  predicted_risk: string;
  top_features: Array<{ feature: string; shap: number; direction: "increases" | "reduces" }>;
};

function parseShapValues(raw: ShapExplanationsRow["shap_values"]): Record<string, number> {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, number>;
    } catch {
      return {};
    }
  }
  return raw as Record<string, number>;
}

export async function getLatest3ShapSummaries(): Promise<ShapSummary[]> {
  const supabase = createSupabaseAdmin();

  const { data: preds, error: predErr } = await supabase
    .from("risk_prediction_history")
    .select("supplier_id,prediction_date,predicted_risk,prob_high,prob_medium,prob_low,model_version")
    .order("prediction_date", { ascending: false })
    .limit(3);
  if (predErr) throw new Error(`Failed to fetch latest predictions: ${predErr.message}`);

  const latest3 = (preds ?? []) as RiskPredictionHistoryRow[];
  const profiles = await getSupplierProfiles();
  const nameById = new Map(profiles.map((p) => [p.supplier_id, p.supplier_name]));

  const summaries: ShapSummary[] = [];
  for (const p of latest3) {
    const { data: shapRows, error: shapErr } = await supabase
      .from("shap_explanations")
      .select("supplier_id,prediction_date,shap_values")
      .eq("supplier_id", p.supplier_id)
      .eq("prediction_date", p.prediction_date)
      .limit(1);
    if (shapErr) throw new Error(`Failed to fetch SHAP: ${shapErr.message}`);

    const shap = (shapRows?.[0] ?? null) as ShapExplanationsRow | null;
    const shapDict = parseShapValues(shap?.shap_values ?? null);

    const top = Object.entries(shapDict)
      .map(([feature, value]) => ({ feature, shap: Number(value) }))
      .filter((x) => Number.isFinite(x.shap))
      .sort((a, b) => Math.abs(b.shap) - Math.abs(a.shap))
      .slice(0, 3)
      .map((x) => ({
        ...x,
        direction: x.shap >= 0 ? ("increases" as const) : ("reduces" as const)
      }));

    summaries.push({
      supplier_id: p.supplier_id,
      supplier_name: nameById.get(p.supplier_id) ?? null,
      prediction_date: p.prediction_date,
      predicted_risk: p.predicted_risk,
      top_features: top
    });
  }

  return summaries;
}

export async function getRecentRiskMasterRows(limit = 200): Promise<SupplierRiskMasterRow[]> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("supplier_risk_master")
    .select(
      "supplier_id,date,on_time_delivery_rate,quality_score,geopolitical_risk_score,communication_score,annual_spending_rupees,total_risk_score,risk_category,industry_segment,supplier_size,is_predicted"
    )
    .order("date", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Failed to fetch supplier_risk_master: ${error.message}`);
  return (data ?? []) as SupplierRiskMasterRow[];
}

export async function getUnpredictedCount(): Promise<number> {
  const supabase = createSupabaseAdmin();
  const { count, error } = await supabase
    .from("supplier_risk_master")
    .select("*", { head: true, count: "exact" })
    .or("is_predicted.eq.false,is_predicted.is.null");
  if (error) throw new Error(`Failed to count unpredicted rows: ${error.message}`);
  return count ?? 0;
}

export async function getWorkflowEvents(): Promise<WorkflowEventRow[]> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("workflow_events")
    .select("id,supplier_id,event_type,created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to fetch workflow_events: ${error.message}`);
  return (data ?? []) as WorkflowEventRow[];
}
