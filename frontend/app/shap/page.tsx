import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getLatestShapForSupplier, getShapSupplierIds } from "@/lib/queries";
import { ChevronDown } from "lucide-react";
import { ShapBarChart } from "@/components/charts/shap-bar-chart";

type Search = { supplier?: string };

function prettyFeature(name: string) {
  return name
    .replaceAll("_", " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default async function ShapPage({ searchParams }: { searchParams?: Search }) {
  const supplierIds = await getShapSupplierIds();
  const selectedSupplier = (searchParams?.supplier ?? supplierIds[0] ?? "").trim();

  if (!selectedSupplier) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">EXPLORE SHAP VALUES</h1>
          <p className="text-muted-foreground/80 mt-1.5">Explain model outputs with feature contributions.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>No SHAP explanations found</CardTitle>
            <CardDescription>Run predictions to generate SHAP values.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const latest = await getLatestShapForSupplier(selectedSupplier);

  const shapEntries = Object.entries(latest?.shap_values ?? {})
    .map(([feature, value]) => ({ feature, value: Number(value) }))
    .filter((x) => Number.isFinite(x.value))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

  const increasing = shapEntries.filter((x) => x.value > 0).slice(0, 5);
  const reducing = shapEntries.filter((x) => x.value < 0).slice(0, 5);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">EXPLORE SHAP VALUES</h1>
        <p className="text-muted-foreground/80 mt-1.5">Understand which features drive risk predictions for each supplier.</p>
      </div>

      <div className="space-y-4">
        <label className="text-sm font-semibold text-foreground">Select Supplier</label>
        <form action="/shap" method="get">
          <div className="relative">
            <select
              name="supplier"
              defaultValue={selectedSupplier}
              className="w-full h-14 rounded-xl border border-border/40 bg-muted/30 px-5 text-base font-semibold appearance-none cursor-pointer hover:bg-muted/50 transition-colors"
            >
              {supplierIds.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" size={20} />
          </div>
          <button type="submit" className="sr-only">Load</button>
        </form>
      </div>

      <Card className="bg-gradient-to-br from-card to-muted/20">
        <CardContent className="pt-6 pb-6">
          <div className="grid grid-cols-2 gap-8">
            <div>
              <div className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider mb-2">
                Supplier ID
              </div>
              <div className="text-2xl font-bold font-mono">{selectedSupplier}</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider mb-2">
                Prediction Date
              </div>
              <div className="text-2xl font-bold">
                {latest?.prediction_date ? new Date(latest.prediction_date).toLocaleDateString() : "N/A"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {increasing.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold">Top Factors Increasing Risk</h2>
          <div className="space-y-3">
            {increasing.map((entry, idx) => {
              const maxAbsValue = Math.max(...shapEntries.map((x) => Math.abs(x.value)));
              const widthPercent = (Math.abs(entry.value) / maxAbsValue) * 100;
              return (
                <Card key={entry.feature} className="overflow-hidden">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-semibold text-muted-foreground/70">{idx + 1}.</span>
                        <span className="text-base font-semibold">{prettyFeature(entry.feature)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
                        <span>↑</span>
                        <span>+{entry.value.toFixed(3)}</span>
                      </div>
                    </div>
                    <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-red-600 to-red-500 rounded-full shadow-lg shadow-red-500/30"
                        style={{ width: `${Math.min(widthPercent, 100)}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {reducing.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold">Top Factors Reducing Risk</h2>
          <div className="space-y-3">
            {reducing.map((entry, idx) => {
              const maxAbsValue = Math.max(...shapEntries.map((x) => Math.abs(x.value)));
              const widthPercent = (Math.abs(entry.value) / maxAbsValue) * 100;
              return (
                <Card key={entry.feature} className="overflow-hidden">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-semibold text-muted-foreground/70">{idx + 1}.</span>
                        <span className="text-base font-semibold">{prettyFeature(entry.feature)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                        <span>↓</span>
                        <span>{entry.value.toFixed(3)}</span>
                      </div>
                    </div>
                    <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-600 to-emerald-500 rounded-full shadow-lg shadow-emerald-500/30"
                        style={{ width: `${Math.min(widthPercent, 100)}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {shapEntries.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground/70">
            No SHAP values found for this supplier.
          </CardContent>
        </Card>
      )}

      {shapEntries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Complete Feature Contribution Chart</CardTitle>
            <CardDescription>All SHAP values sorted by absolute magnitude</CardDescription>
          </CardHeader>
          <CardContent>
            <ShapBarChart data={shapEntries.map((x) => ({ feature: prettyFeature(x.feature), value: x.value }))} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
