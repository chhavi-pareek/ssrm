export type SupplierProfile = {
  supplier_id: string;
  supplier_name: string;
  country: string | null;
  established_year: number | null;
  primary_contact_email: string | null;
};

export type SupplierRiskMasterRow = {
  supplier_id: string;
  date: string; // ISO date
  on_time_delivery_rate: number | null;
  quality_score: number | null;
  geopolitical_risk_score: number | null;
  communication_score: number | null;
  annual_spending_rupees: number | null;
  total_risk_score: number | null;
  risk_category: string | null;
  industry_segment: string | null;
  supplier_size: string | null;
  is_predicted: boolean | null;
};

export type RiskPredictionHistoryRow = {
  prediction_id?: string | number;
  supplier_id: string;
  prediction_date: string; // ISO timestamp
  predicted_risk: "High Risk" | "Medium Risk" | "Low Risk" | "High" | "Medium" | "Low" | string;
  prob_high: number | null;
  prob_medium: number | null;
  prob_low: number | null;
  model_version: string | null;
  created_at?: string;
};

export type ShapExplanationsRow = {
  shap_id?: string | number;
  supplier_id: string;
  prediction_date: string; // ISO timestamp
  shap_values: Record<string, number> | string | null;
  created_at?: string;
};

export type WorkflowEventRow = {
  id: string;
  supplier_id: string;
  event_type: string;
  created_at: string;
};
