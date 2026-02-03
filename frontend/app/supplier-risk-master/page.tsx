import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getRiskMasterFilterOptions, getRiskMasterPage } from "@/lib/queries";
import { AddSupplierDialog } from "@/components/add-supplier-dialog";

type Search = {
  supplier?: string;
  risk?: string;
  industry?: string;
  page?: string;
};

export default async function SupplierRiskMasterPage({ searchParams }: { searchParams?: Search }) {
  const supplier = (searchParams?.supplier ?? "All").trim() || "All";
  const risk = (searchParams?.risk ?? "All").trim() || "All";
  const industry = (searchParams?.industry ?? "All").trim() || "All";
  const page = Number(searchParams?.page ?? "1") || 1;

  const [options, pageData] = await Promise.all([
    getRiskMasterFilterOptions(),
    getRiskMasterPage({
      page,
      pageSize: 20,
      supplierId: supplier !== "All" ? supplier : undefined,
      riskCategory: risk !== "All" ? risk : undefined,
      industry: industry !== "All" ? industry : undefined
    })
  ]);

  const totalPages = Math.max(1, Math.ceil(pageData.total / pageData.pageSize));
  const safePage = Math.min(Math.max(1, pageData.page), totalPages);

  const exportHref = (() => {
    const params = new URLSearchParams();
    params.set("supplier", supplier);
    params.set("risk", risk);
    params.set("industry", industry);
    return `/api/supabase/export-risk-master?${params.toString()}`;
  })();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Suppliers</h1>
          <p className="text-sm text-muted-foreground">Browse supplier risk master records and export filtered results.</p>
        </div>
        <AddSupplierDialog />
      </div>

      <Card>
        <CardHeader className="space-y-2">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <CardTitle>Supplier Risk Master</CardTitle>
              <CardDescription>
                Showing {pageData.total} of {options.totalRows} records
              </CardDescription>
            </div>
            <a
              href={exportHref}
              className="h-10 inline-flex items-center justify-center rounded-md border border-border/60 bg-card px-4 text-sm font-medium hover:bg-muted"
            >
              Download CSV
            </a>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="grid grid-cols-1 gap-3 md:grid-cols-3" action="/supplier-risk-master" method="get">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Filter by Supplier ID</label>
              <select
                name="supplier"
                defaultValue={supplier}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {options.supplierIds.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Filter by Risk Category</label>
              <select
                name="risk"
                defaultValue={risk}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {options.riskCategories.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Filter by Industry Segment</label>
              <select
                name="industry"
                defaultValue={industry}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {options.industrySegments.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <input type="hidden" name="page" value="1" />
            <div className="md:col-span-3 flex justify-end gap-2">
              <a
                href="/supplier-risk-master"
                className="h-10 inline-flex items-center justify-center rounded-md border border-border/60 bg-card px-4 text-sm font-medium hover:bg-muted"
              >
                Reset
              </a>
              <button className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90">
                Apply
              </button>
            </div>
          </form>

          <div className="overflow-auto rounded-md border border-border/60">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>supplier_id</TableHead>
                  <TableHead>date</TableHead>
                  <TableHead>on_time_delivery_rate</TableHead>
                  <TableHead>quality_score</TableHead>
                  <TableHead>geopolitical_risk_score</TableHead>
                  <TableHead>communication_score</TableHead>
                  <TableHead>annual_spending_rupees</TableHead>
                  <TableHead>total_risk_score</TableHead>
                  <TableHead>risk_category</TableHead>
                  <TableHead>industry_segment</TableHead>
                  <TableHead>supplier_size</TableHead>
                  <TableHead>is_predicted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageData.rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-muted-foreground text-center py-8">
                      No supplier risk master data found. Upload data to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  pageData.rows.map((r, idx) => (
                    <TableRow key={`${r.supplier_id}-${r.date}-${idx}`}>
                      <TableCell className="font-mono text-xs">{r.supplier_id}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(r.date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{r.on_time_delivery_rate ?? "N/A"}</TableCell>
                      <TableCell>{r.quality_score ?? "N/A"}</TableCell>
                      <TableCell>{r.geopolitical_risk_score ?? "N/A"}</TableCell>
                      <TableCell>{r.communication_score ?? "N/A"}</TableCell>
                      <TableCell>{r.annual_spending_rupees ?? "N/A"}</TableCell>
                      <TableCell>{r.total_risk_score ?? "N/A"}</TableCell>
                      <TableCell>{r.risk_category ?? "N/A"}</TableCell>
                      <TableCell>{r.industry_segment ?? "N/A"}</TableCell>
                      <TableCell>{r.supplier_size ?? "N/A"}</TableCell>
                      <TableCell>{String(r.is_predicted ?? "N/A")}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Page {safePage} of {totalPages}
            </div>
            <div className="flex gap-2">
              <a
                href={`/supplier-risk-master?supplier=${encodeURIComponent(supplier)}&risk=${encodeURIComponent(
                  risk
                )}&industry=${encodeURIComponent(industry)}&page=${Math.max(1, safePage - 1)}`}
                className={`h-10 rounded-md border px-4 text-sm flex items-center ${
                  safePage <= 1 ? "pointer-events-none opacity-50" : "hover:bg-muted"
                }`}
              >
                Prev
              </a>
              <a
                href={`/supplier-risk-master?supplier=${encodeURIComponent(supplier)}&risk=${encodeURIComponent(
                  risk
                )}&industry=${encodeURIComponent(industry)}&page=${Math.min(totalPages, safePage + 1)}`}
                className={`h-10 rounded-md border px-4 text-sm flex items-center ${
                  safePage >= totalPages ? "pointer-events-none opacity-50" : "hover:bg-muted"
                }`}
              >
                Next
              </a>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
