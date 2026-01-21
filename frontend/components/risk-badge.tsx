import { Badge } from "@/components/ui/badge";

export function RiskBadge({ risk }: { risk: string | null | undefined }) {
  const normalized = (risk ?? "").toLowerCase().replaceAll("_", " ").trim();
  if (normalized === "high" || normalized === "high risk") return <Badge variant="riskHigh">High Risk</Badge>;
  if (normalized === "medium" || normalized === "medium risk")
    return <Badge variant="riskMedium">Medium Risk</Badge>;
  if (normalized === "low" || normalized === "low risk") return <Badge variant="riskLow">Low Risk</Badge>;
  return <Badge variant="outline">Unknown</Badge>;
}

