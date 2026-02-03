import { RiskBadge } from "@/components/risk-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAllPredictions } from "@/lib/queries";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

function pct(v: number | null | undefined) {
  if (typeof v !== "number" || !Number.isFinite(v)) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

export default async function PredictionsPage({
  searchParams
}: {
  searchParams?: { sort_by?: string; order?: string };
}) {
  const sortByRaw = (searchParams?.sort_by ?? "prediction_date").trim();
  const sortBy =
    sortByRaw === "prob_high" || sortByRaw === "prob_medium" || sortByRaw === "prob_low"
      ? (sortByRaw as "prob_high" | "prob_medium" | "prob_low")
      : ("prediction_date" as const);
  const orderRaw = (searchParams?.order ?? "Descending").trim();
  const ascending = orderRaw === "Ascending";

  const rows = await getAllPredictions({ sortBy, ascending });

  const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replaceAll("_", " ").trim();
  const highCount = rows.filter((r) => norm(r.predicted_risk) === "high" || norm(r.predicted_risk) === "high risk").length;
  const mediumCount = rows.filter((r) => norm(r.predicted_risk) === "medium" || norm(r.predicted_risk) === "medium risk").length;
  const lowCount = rows.filter((r) => norm(r.predicted_risk) === "low" || norm(r.predicted_risk) === "low risk").length;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">Predictions</h1>
          <p className="text-muted-foreground/80 mt-1.5">Time-series prediction history with sorting controls.</p>
        </div>
        <Link 
          href="https://colab.research.google.com/drive/1UiDOWZ1AANTD83A-gdMxWOAOjduVnAY5?usp=sharing"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 h-10 rounded-lg bg-gradient-to-r from-primary to-primary/90 px-5 text-sm font-semibold text-white shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all"
        >
          View Model
          <ExternalLink className="w-4 h-4" />
        </Link>
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <CardTitle>Prediction History</CardTitle>
              <CardDescription>
                Showing {rows.length} rows
              </CardDescription>
            </div>
            <form className="flex items-end gap-3" action="/predictions" method="get">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground/80">Sort by</label>
                <select
                  name="sort_by"
                  defaultValue={sortBy}
                  className="h-10 rounded-lg border border-border/40 bg-muted/30 px-3 text-sm hover:bg-muted/50 transition-colors"
                >
                  <option value="prediction_date">Prediction Date</option>
                  <option value="prob_high">High Probability</option>
                  <option value="prob_medium">Medium Probability</option>
                  <option value="prob_low">Low Probability</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground/80">Order</label>
                <select
                  name="order"
                  defaultValue={orderRaw}
                  className="h-10 rounded-lg border border-border/40 bg-muted/30 px-3 text-sm hover:bg-muted/50 transition-colors"
                >
                  <option value="Descending">Descending</option>
                  <option value="Ascending">Ascending</option>
                </select>
              </div>
              <button className="h-10 rounded-lg bg-gradient-to-r from-primary to-primary/90 px-5 text-sm font-semibold text-white shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all">
                Apply
              </button>
            </form>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto rounded-lg border border-border/30">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>High Prob</TableHead>
                  <TableHead>Med Prob</TableHead>
                  <TableHead>Low Prob</TableHead>
                  <TableHead>Model</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-muted-foreground/70 text-center py-12">
                      No predictions found.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r, idx) => (
                    <TableRow key={`${r.supplier_id}-${r.prediction_date}-${idx}`}>
                      <TableCell className="text-xs font-mono font-medium">{(r as any).prediction_id ?? "—"}</TableCell>
                      <TableCell className="font-semibold">{r.supplier_id}</TableCell>
                      <TableCell className="text-sm text-muted-foreground/80">
                        {new Date(r.prediction_date).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <RiskBadge risk={r.predicted_risk} />
                      </TableCell>
                      <TableCell className="font-medium">{pct(r.prob_high)}</TableCell>
                      <TableCell className="text-muted-foreground/80">{pct(r.prob_medium)}</TableCell>
                      <TableCell className="text-muted-foreground/80">{pct(r.prob_low)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground/70">{r.model_version ?? "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* No KPI cards here by design */}
    </div>
  );
}

