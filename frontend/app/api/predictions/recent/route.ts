import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const since = searchParams.get("since");
    
    const supabase = createSupabaseAdmin();
    
    let query = supabase
      .from("risk_prediction_history")
      .select("*")
      .order("prediction_date", { ascending: false });
    
    if (since) {
      query = query.gte("prediction_date", since);
    }
    
    const { data, error } = await query.limit(100);
    
    if (error) {
      return NextResponse.json(
        { error: `Failed to fetch predictions: ${error.message}` },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      count: data?.length || 0,
      predictions: data || []
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
