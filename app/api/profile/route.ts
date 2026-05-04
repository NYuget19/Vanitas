import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { MissingDatabaseUrlError, ensureProfile, getSql, rowsOf } from "@/lib/db";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await currentUser();
    const profile = await ensureProfile({
      id: userId,
      email: user?.primaryEmailAddress?.emailAddress,
      nickname: user?.username || user?.firstName,
    });

    return NextResponse.json({ profile });
  } catch (error) {
    if (error instanceof MissingDatabaseUrlError) {
      return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: "Profile request failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await request.json()) as { nickname?: string };
    const nickname = String(body.nickname || "").trim().slice(0, 18);
    if (!nickname) return NextResponse.json({ error: "Nickname is required" }, { status: 400 });

    const user = await currentUser();
    await ensureProfile({
      id: userId,
      email: user?.primaryEmailAddress?.emailAddress,
      nickname,
    });

    const sql = getSql();
    const rows = rowsOf(await sql`
      update profiles
      set nickname = ${nickname},
          updated_at = now()
      where user_id = ${userId}
      returning user_id, email, nickname, created_at, updated_at
    `);

    return NextResponse.json({ profile: rows[0] });
  } catch (error) {
    if (error instanceof MissingDatabaseUrlError) {
      return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: "Profile update failed" }, { status: 500 });
  }
}
