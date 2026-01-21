import { NextResponse } from "next/server";
import { getUnpredictedCount } from "@/lib/queries";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const count = await getUnpredictedCount();
    console.log(`Unpredicted count: ${count}`);
    return NextResponse.json({ count }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      }
    });
  } catch (err) {
    console.error('Error getting unpredicted count:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
