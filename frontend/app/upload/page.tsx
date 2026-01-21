"use client";

import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Record<string, any>[]>([]);
  const [rowCount, setRowCount] = useState<number>(0);
  const [uniqueSuppliers, setUniqueSuppliers] = useState<number>(0);
  const [validation, setValidation] = useState<{ valid: boolean; missing: string[] } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; details?: any } | null>(null);

  const [unpredictedCount, setUnpredictedCount] = useState<number | null>(null);
  const [triggerResult, setTriggerResult] = useState<{ success: boolean; message: string; details?: any } | null>(
    null
  );
  const [triggering, setTriggering] = useState(false);
  const [dagRunId, setDagRunId] = useState<string | null>(null);
  const [dagStatus, setDagStatus] = useState<string | null>(null);
  const [recentPredictions, setRecentPredictions] = useState<any[]>([]);
  const [showPredictions, setShowPredictions] = useState(false);

  const [supabaseOk, setSupabaseOk] = useState<boolean | null>(null);
  const [airflowHealth, setAirflowHealth] = useState<{ ok: boolean; status?: number } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    setPreview([]);
    setRowCount(0);
    setUniqueSuppliers(0);
    setValidation(null);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = String(event.target?.result ?? "");
        const parsed = Papa.parse<Record<string, any>>(text, { header: true, skipEmptyLines: true });
        const headers = (parsed.meta.fields ?? []).map((h) => String(h).trim());
        const missing = REQUIRED_COLUMNS.filter((col) => !headers.includes(col));
        if (missing.length > 0) {
          setValidation({ valid: false, missing });
          return;
        }

        const rows = (parsed.data ?? []).filter((r) => r && Object.keys(r).length > 0);
        setRowCount(rows.length);
        const ids = new Set(rows.map((r) => String(r["supplier_id"] ?? "").trim()).filter(Boolean));
        setUniqueSuppliers(ids.size);
        setPreview(rows.slice(0, 10));
        setValidation({ valid: true, missing: [] });
      } catch {
        setValidation({ valid: false, missing: ["Failed to parse CSV"] });
      }
    };
    reader.readAsText(selected);
  };

  const handleUpload = async () => {
    if (!file || !validation?.valid) return;

    setUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/supabase/upload-csv", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      setResult({ success: true, message: `✅ Successfully uploaded ${data.inserted} records to database!`, details: data });
      setFile(null);
      setPreview([]);
      setRowCount(0);
      setUniqueSuppliers(0);
      setValidation(null);
      await refreshUnpredicted();
    } catch (err) {
      setResult({ success: false, message: err instanceof Error ? err.message : "Upload failed" });
    } finally {
      setUploading(false);
    }
  };

  const refreshUnpredicted = async () => {
    try {
      console.log('Refreshing unpredicted count...');
      const res = await fetch("/api/supabase/unpredicted-count", {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      const data = await res.json();
      console.log('Unpredicted count response:', data);
      if (res.ok) {
        setUnpredictedCount(data.count ?? 0);
      } else {
        console.error('Failed to fetch unpredicted count:', data);
      }
    } catch (err) {
      console.error('Error fetching unpredicted count:', err);
    }
  };

  const triggerDag = async () => {
    setTriggering(true);
    setTriggerResult(null);
    setDagRunId(null);
    setDagStatus("queued");
    setShowPredictions(false);
    const triggerTime = new Date().toISOString();
    
    try {
      const res = await fetch("/api/airflow/trigger", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to trigger DAG");
      
      const runId = data.details?.dag_run_id;
      setDagRunId(runId);
      setDagStatus("running");
      setTriggerResult({ success: true, message: data.message || "✅ Airflow DAG triggered successfully!", details: data.details });
      
      // Poll for status
      if (runId) {
        pollDagStatus(runId, triggerTime);
      }
    } catch (err) {
      setDagStatus(null);
      setTriggerResult({ success: false, message: err instanceof Error ? err.message : "Failed to trigger DAG" });
      setTriggering(false);
    }
  };

  const pollDagStatus = async (runId: string, triggerTime: string) => {
    const maxAttempts = 60; // Poll for up to 5 minutes
    let attempts = 0;
    
    const poll = async () => {
      attempts++;
      console.log(`Polling DAG status (attempt ${attempts}/${maxAttempts})...`);
      
      try {
        const res = await fetch(`/api/airflow/dag-run/${encodeURIComponent(runId)}`, {
          cache: 'no-store'
        });
        const data = await res.json();
        
        console.log('Poll response:', data);
        
        if (data.success && data.data) {
          const state = data.data.state;
          console.log(`DAG state: ${state}`);
          setDagStatus(state);
          
          if (state === "success") {
            console.log('DAG completed successfully');
            setTriggering(false);
            await refreshUnpredicted();
            await fetchRecentPredictions(triggerTime);
            setShowPredictions(true);
            return;
          } else if (state === "failed") {
            console.log('DAG failed');
            setTriggering(false);
            setTriggerResult({ 
              success: false, 
              message: "❌ DAG run failed. Check Airflow for details.",
              details: data.data 
            });
            return;
          } else if (state === "running" || state === "queued") {
            // Continue polling
            if (attempts < maxAttempts) {
              console.log(`DAG still ${state}, polling again in 5s...`);
              setTimeout(poll, 5000);
            } else {
              console.log('Polling timeout reached');
              setTriggering(false);
              setTriggerResult({
                success: false,
                message: "⏱️ Polling timeout. DAG may still be running. Check Airflow."
              });
            }
          }
        } else {
          console.error('Error fetching status:', data.error);
          // Error fetching status, retry
          if (attempts < maxAttempts) {
            setTimeout(poll, 5000);
          } else {
            setTriggering(false);
            setTriggerResult({
              success: false,
              message: "Failed to fetch DAG status. Check Airflow."
            });
          }
        }
      } catch (err) {
        console.error('Poll error:', err);
        if (attempts < maxAttempts) {
          setTimeout(poll, 5000);
        } else {
          setTriggering(false);
          setTriggerResult({
            success: false,
            message: "Error polling DAG status."
          });
        }
      }
    };
    
    // Start polling after a short delay
    console.log('Starting DAG status polling...');
    setTimeout(poll, 2000);
  };

  const fetchRecentPredictions = async (since: string) => {
    try {
      const res = await fetch(`/api/predictions/recent?since=${encodeURIComponent(since)}`);
      const data = await res.json();
      if (data.success) {
        setRecentPredictions(data.predictions || []);
      }
    } catch (err) {
      // ignore
    }
  };

  const runSystemChecks = async () => {
    try {
      const s = await fetch("/api/supabase/health");
      const sd = await s.json();
      setSupabaseOk(Boolean(sd.ok));
    } catch {
      setSupabaseOk(false);
    }

    try {
      const a = await fetch("/api/airflow/health");
      const ad = await a.json();
      setAirflowHealth({ ok: Boolean(ad.ok), status: ad.status });
    } catch {
      setAirflowHealth({ ok: false });
    }
  };

  useEffect(() => {
    refreshUnpredicted();
    runSystemChecks();
  }, []);

  const previewHeaders = useMemo(() => Object.keys(preview[0] ?? {}), [preview]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Upload & Pipeline</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload Supplier Data</CardTitle>
          <CardDescription>
            Upload a CSV file with supplier risk metrics. The file will be validated and inserted into the database.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
          />

          {preview.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Preview (first 10 rows):</div>
              <div className="max-h-[400px] overflow-auto rounded-md border border-border/60">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {previewHeaders.map((h) => (
                        <TableHead key={h} className="text-xs">
                          {h}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((row, idx) => (
                      <TableRow key={idx}>
                        {previewHeaders.map((h) => (
                          <TableCell key={h} className="text-xs">
                            {String(row[h] ?? "").slice(0, 40)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {validation && (
            <div
              className={`rounded-md border px-4 py-3 text-sm ${
                validation.valid ? "bg-green-950/30 border-green-900 text-green-200" : "bg-red-950/30 border-red-900 text-red-200"
              }`}
            >
              {validation.valid ? (
                <div>✅ CSV validation passed!</div>
              ) : (
                <div>
                  ❌ CSV validation failed. Missing columns: {validation.missing.join(", ")}
                </div>
              )}
            </div>
          )}

          {validation?.valid && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-md border border-border/60 bg-card p-4">
                <div className="text-sm text-muted-foreground">Total Rows</div>
                <div className="text-2xl font-semibold">{rowCount}</div>
              </div>
              <div className="rounded-md border border-border/60 bg-card p-4">
                <div className="text-sm text-muted-foreground">Unique Suppliers</div>
                <div className="text-2xl font-semibold">{uniqueSuppliers}</div>
              </div>
            </div>
          )}

          <Button onClick={handleUpload} disabled={!file || !validation?.valid || uploading} className="w-full">
            {uploading ? "Uploading..." : "Upload to Database"}
          </Button>

          {result && (
            <div
              className={`rounded-md border px-4 py-3 text-sm ${
                result.success ? "bg-green-950/30 border-green-900 text-green-200" : "bg-red-950/30 border-red-900 text-red-200"
              }`}
            >
              <div className="font-medium">{result.message}</div>
              {result.details && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs">Show upload details</summary>
                  <pre className="mt-2 text-xs overflow-auto bg-black/30 p-2 rounded">
                    {JSON.stringify(result.details, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          )}

          <details className="rounded-md border border-border/60 bg-card p-4">
            <summary className="cursor-pointer text-sm font-medium">Show Required Columns</summary>
            <pre className="mt-3 text-xs bg-black/30 p-3 rounded overflow-auto">
{REQUIRED_COLUMNS.join("\n")}
            </pre>
          </details>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Trigger Prediction Pipeline</CardTitle>
          <CardDescription>
            Click the button below to trigger the Airflow DAG that will:
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground whitespace-pre-line">
{`1. Fetch all suppliers with \`is_predicted = false\`
2. Run LightGBM risk prediction model
3. Generate SHAP explanations
4. Save results to \`risk_prediction_history\` and \`shap_explanations\` tables
5. Update \`is_predicted = true\``}
          </div>

          {typeof unpredictedCount === "number" && (
            <div
              className={`rounded-lg border px-4 py-3 flex items-center justify-between ${
                unpredictedCount > 0
                  ? "bg-amber-950/30 border-amber-900/40 text-amber-200"
                  : "bg-emerald-950/30 border-emerald-900/40 text-emerald-200"
              }`}
            >
              <span className="text-sm">
                {unpredictedCount > 0
                  ? `⚠️ ${unpredictedCount} records pending prediction`
                  : "✅ All records have been predicted"}
              </span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={refreshUnpredicted}
                className="ml-3 h-8 text-xs"
              >
                Refresh
              </Button>
            </div>
          )}

          {dagStatus && (
            <div className={`rounded-lg border px-5 py-4 ${
              dagStatus === "queued" ? "bg-blue-950/30 border-blue-900/40" :
              dagStatus === "running" ? "bg-indigo-950/30 border-indigo-900/40" :
              dagStatus === "success" ? "bg-emerald-950/30 border-emerald-900/40" :
              "bg-red-950/30 border-red-900/40"
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold mb-1">
                    {dagStatus === "queued" && "⏱️ DAG Queued"}
                    {dagStatus === "running" && "🔄 DAG Running"}
                    {dagStatus === "success" && "✅ DAG Completed"}
                    {dagStatus === "failed" && "❌ DAG Failed"}
                  </div>
                  <div className="text-xs text-muted-foreground/80">
                    {dagStatus === "queued" && "Waiting to start..."}
                    {dagStatus === "running" && "Processing predictions..."}
                    {dagStatus === "success" && "All predictions completed successfully"}
                    {dagStatus === "failed" && "Execution failed. Check logs."}
                  </div>
                </div>
                {dagRunId && (
                  <a 
                    href={`http://localhost:8080/dags/srrm_prediction_dag/grid?dag_run_id=${encodeURIComponent(dagRunId)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs px-3 py-1.5 rounded-md bg-primary/20 hover:bg-primary/30 text-primary-foreground border border-primary/40 transition-colors"
                  >
                    View in Airflow →
                  </a>
                )}
              </div>
            </div>
          )}

          <Button onClick={triggerDag} disabled={triggering || dagStatus === "running"} className="w-full bg-gradient-to-r from-primary to-primary/90 hover:shadow-lg hover:shadow-primary/30 transition-all" size="lg">
            {triggering ? (dagStatus === "running" ? "Running..." : "Triggering...") : "Run Airflow Prediction DAG"}
          </Button>

          {showPredictions && recentPredictions.length > 0 && (
            <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-base font-semibold text-emerald-200">Predictions Made in This Run</div>
                  <div className="text-sm text-emerald-300/70">{recentPredictions.length} new predictions generated</div>
                </div>
              </div>
              <div className="max-h-[300px] overflow-auto rounded-lg border border-border/30">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Supplier ID</TableHead>
                      <TableHead>Risk</TableHead>
                      <TableHead>High Prob</TableHead>
                      <TableHead>Medium Prob</TableHead>
                      <TableHead>Low Prob</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentPredictions.slice(0, 10).map((pred, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-mono text-xs">{pred.supplier_id}</TableCell>
                        <TableCell className="text-xs">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            pred.predicted_risk?.toLowerCase().includes("high") ? "bg-red-950/40 text-red-200" :
                            pred.predicted_risk?.toLowerCase().includes("medium") ? "bg-amber-950/40 text-amber-200" :
                            "bg-emerald-950/40 text-emerald-200"
                          }`}>
                            {pred.predicted_risk}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs">{(pred.prob_high * 100).toFixed(1)}%</TableCell>
                        <TableCell className="text-xs">{(pred.prob_medium * 100).toFixed(1)}%</TableCell>
                        <TableCell className="text-xs">{(pred.prob_low * 100).toFixed(1)}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {recentPredictions.length > 10 && (
                <div className="text-xs text-muted-foreground/70 text-center">
                  Showing 10 of {recentPredictions.length} predictions
                </div>
              )}
            </div>
          )}

          {triggerResult && (
            <div
              className={`rounded-lg border px-4 py-3 text-sm ${
                triggerResult.success
                  ? "bg-green-950/30 border-green-900/40 text-green-200"
                  : "bg-red-950/30 border-red-900/40 text-red-200"
              }`}
            >
              <div className="font-medium">{triggerResult.success ? "✅" : "❌"} {triggerResult.message}</div>
              {triggerResult.details && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs">Show DAG Run Details</summary>
                  <pre className="mt-2 text-xs overflow-auto bg-black/30 p-2 rounded">
                    {JSON.stringify(triggerResult.details, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>🔧 System Status</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-md border border-border/60 bg-card p-4">
            <div className="text-sm font-medium mb-2">Database Connection:</div>
            <div className="text-sm text-muted-foreground">
              {supabaseOk === null ? "Checking..." : supabaseOk ? "✅ Connected to Supabase" : "❌ Supabase connection failed"}
            </div>
          </div>
          <div className="rounded-md border border-border/60 bg-card p-4">
            <div className="text-sm font-medium mb-2">Airflow API:</div>
            <div className="text-sm text-muted-foreground">
              {airflowHealth === null
                ? "Checking..."
                : airflowHealth.ok
                ? "✅ Airflow API reachable"
                : `❌ Airflow API unreachable${airflowHealth.status ? ` (status ${airflowHealth.status})` : ""}`}
            </div>
          </div>
          <div className="md:col-span-2 flex justify-end">
            <Button variant="outline" onClick={runSystemChecks}>
              Re-check Status
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
