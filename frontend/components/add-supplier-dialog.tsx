"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";

export function AddSupplierDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const data = {
      supplier_id: formData.get("supplier_id") as string,
      supplier_name: formData.get("supplier_name") as string,
      country: formData.get("country") as string,
      established_year: parseInt(formData.get("established_year") as string),
      primary_contact_email: formData.get("primary_contact_email") as string,
    };

    try {
      const response = await fetch("/api/suppliers/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to add supplier");
      }

      setOpen(false);
      router.refresh();
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} className="gap-2">
        <Plus className="w-4 h-4" />
        Add Supplier
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="relative z-50 w-full max-w-md bg-background border border-border rounded-lg shadow-lg p-6 mx-4">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">Add New Supplier</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Enter the supplier information. All fields are required.
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-sm opacity-70 hover:opacity-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="supplier_id" className="text-sm font-medium">
              Supplier ID *
            </label>
            <input
              id="supplier_id"
              name="supplier_id"
              type="text"
              required
              placeholder="e.g., SUP-001"
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="supplier_name" className="text-sm font-medium">
              Supplier Name *
            </label>
            <input
              id="supplier_name"
              name="supplier_name"
              type="text"
              required
              placeholder="e.g., ABC Corporation"
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="country" className="text-sm font-medium">
              Country *
            </label>
            <input
              id="country"
              name="country"
              type="text"
              required
              placeholder="e.g., India"
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="established_year" className="text-sm font-medium">
              Established Year *
            </label>
            <input
              id="established_year"
              name="established_year"
              type="number"
              required
              min="1800"
              max="2026"
              placeholder="e.g., 2010"
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="primary_contact_email" className="text-sm font-medium">
              Primary Contact Email *
            </label>
            <input
              id="primary_contact_email"
              name="primary_contact_email"
              type="email"
              required
              placeholder="e.g., contact@supplier.com"
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            />
          </div>

          {error && (
            <div className="text-sm text-red-500 bg-red-50 dark:bg-red-950/20 p-3 rounded-md">
              {error}
            </div>
          )}

          <div className="flex gap-3 justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Adding..." : "Add Supplier"}
            </Button>
          </div>
        </form>
          </div>
        </div>
      )}
    </>
  );
}
