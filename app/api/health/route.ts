import { NextResponse } from "next/server";
import { checkDatabaseConnection, publicDbError } from "@/lib/dbHealth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const report = await checkDatabaseConnection();
    return NextResponse.json(report);
  } catch (error) {
    const details = publicDbError(error);
    return NextResponse.json({ ok: false, ...details }, { status: 503 });
  }
}
