import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

// Read-only proxy for delegate screens (/screen/<token>).
//
// Requires a staff session like every other page; the token then picks which
// audience's view to show. It forwards exactly one backend endpoint, whose
// response is already filtered to what that link's audience may see. Tokens
// stay random and rotatable from the Groups tab.
const INTERNAL_API_BASE_URL = process.env.INTERNAL_API_BASE_URL ?? "http://backend:8000";
const ADMIN_API_TOKEN = process.env.ADMIN_API_TOKEN;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }
  const { token } = await params;
  if (!/^[0-9a-f]{32}$/.test(token)) {
    return NextResponse.json({ detail: "This screen link is not valid." }, { status: 404 });
  }
  const headers = new Headers();
  if (ADMIN_API_TOKEN) headers.set("x-admin-token", ADMIN_API_TOKEN);
  try {
    const res = await fetch(`${INTERNAL_API_BASE_URL}/api/screens/${token}`, { headers, cache: "no-store" });
    return new NextResponse(res.body, {
      status: res.status,
      headers: { "content-type": res.headers.get("content-type") ?? "application/json", "cache-control": "no-store" },
    });
  } catch {
    return NextResponse.json({ detail: "Backend is unreachable." }, { status: 502 });
  }
}
