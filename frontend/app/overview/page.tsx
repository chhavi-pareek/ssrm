import { RiskBadge } from "@/components/risk-badge";
import { RiskDistributionChart } from "@/components/charts/risk-distribution-chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getExecutiveOverview } from "@/lib/queries";

function pct(v: number | null | undefined) {
  if (typeof v !== "number" || !Number.isFinite(v)) return "0.00%";
  return `${(v * 100).toFixed(2)}%`;
}

export default async function OverviewPage() {
  const overview = await getExecutiveOverview();

  const distributionData = [
    { risk: "High", count: overview.riskCounts.High },
    { risk: "Medium", count: overview.riskCounts.Medium },
    { risk: "Low", count: overview.riskCounts.Low },
    ...(overview.riskCounts.Unknown > 0 ? [{ risk: "Unknown", count: overview.riskCounts.Unknown }] : [])
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">Executive Overview</h1>
        <p className="text-muted-foreground/80 mt-1.5">Supplier risk by majority prediction across all history, top risks from complete data.</p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Suppliers</CardDescription>
            <CardTitle className="text-4xl font-bold">{overview.totalSuppliers}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Predictions</CardDescription>
            <CardTitle className="text-4xl font-bold">{overview.totalPredictions}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>High-Risk Suppliers</CardDescription>
            <CardTitle className="text-4xl font-bold text-red-400">{overview.riskCounts.High}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Avg High Risk Prob</CardDescription>
            <CardTitle className="text-4xl font-bold">{pct(overview.avgProbHigh)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top High-Risk Predictions</CardTitle>
          <CardDescription>Highest prob_high across all prediction history</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto rounded-lg border border-border/30">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier ID</TableHead>
                  <TableHead>Risk Level</TableHead>
                  <TableHead>High Prob</TableHead>
                  <TableHead>Medium Prob</TableHead>
                  <TableHead>Low Prob</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Model</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overview.topHighRisk.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground/70 text-center py-12">
                      No prediction data available yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  overview.topHighRisk.slice(0, 5).map((p) => (
                    <TableRow key={`${p.supplier_id}-${p.prediction_date}`}>
                      <TableCell className="font-mono text-xs font-medium">{p.supplier_id}</TableCell>
                      <TableCell>
                        <RiskBadge risk={p.predicted_risk} />
                      </TableCell>
                      <TableCell className="font-semibold">{pct(p.prob_high)}</TableCell>
                      <TableCell className="text-muted-foreground/80">{pct(p.prob_medium)}</TableCell>
                      <TableCell className="text-muted-foreground/80">{pct(p.prob_low)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground/70">
                        {new Date(p.prediction_date).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground/70">{p.model_version ?? "N/A"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Risk Distribution</CardTitle>
          <CardDescription>Based on majority prediction per supplier across all history</CardDescription>
        </CardHeader>
        <CardContent>
          <RiskDistributionChart data={distributionData} />
        </CardContent>
      </Card>
    </div>
  );
}
