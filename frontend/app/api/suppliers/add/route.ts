import { createSupabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { supplier_id, supplier_name, country, established_year, primary_contact_email } = body;

    // Validate required fields
    if (!supplier_id || !supplier_name || !country || !established_year || !primary_contact_email) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(primary_contact_email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Validate year
    if (established_year < 1800 || established_year > 2026) {
      return NextResponse.json(
        { error: "Year must be between 1800 and 2026" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdmin();

    // Check if supplier_id already exists
    const { data: existing } = await supabase
      .from("supplier_profile")
      .select("supplier_id")
      .eq("supplier_id", supplier_id)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "Supplier ID already exists" },
        { status: 409 }
      );
    }

    // Insert new supplier
    const { data, error } = await supabase
      .from("supplier_profile")
      .insert({
        supplier_id,
        supplier_name,
        country,
        established_year,
        primary_contact_email,
      })
      .select()
      .single();

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json(
        { error: error.message || "Failed to add supplier" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    console.error("Error adding supplier:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
