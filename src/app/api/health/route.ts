import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", db: "connected", timestamp: new Date().toISOString() });
  } catch (error: any) {
    console.log("Error occurred:", error);
    return NextResponse.json({
      status: "error",
      db: "disconnected",
      name: error?.name,
      message: error?.message,        
      errorCode: error?.errorCode,
      hasUrl: !!process.env.DATABASE_URL,
      urlPrefix: process.env.DATABASE_URL?.slice(0, 25), // primeros chars, sin password
    }, { status: 500 });
  }
}
