import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { MissingDatabaseUrlError, ensureProfile, getSql, rowsOf } from "@/lib/db";

type VanishootSavePayload = {
  gold?: number;
  upgrades?: Record<string, number>;
  currentScore?: number;
  wave?: number;
};

async function requireProfile() {
  const { userId } = await auth();
  if (!userId) return null;

  const user = await currentUser();
  await ensureProfile({
    id: userId,
    email: user?.primaryEmailAddress?.emailAddress,
    nickname: user?.username || user?.firstName,
  });

  return userId;
}

export async function GET() {
  try {
    const userId = await requireProfile();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const sql = getSql();
    const rows = rowsOf(await sql`
      select gold, upgrades, best_score, best_wave, total_runs, updated_at
      from vanishoot_saves
      where user_id = ${userId}
    `);

    return NextResponse.json({
      save: rows[0] || {
        gold: 0,
        upgrades: {},
        best_score: 0,
        best_wave: 1,
        total_runs: 0,
      },
    });
  } catch (error) {
    if (error instanceof MissingDatabaseUrlError) {
      return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: "Save request failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireProfile();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await request.json()) as VanishootSavePayload;
    const gold = Math.max(0, Math.floor(Number(body.gold || 0)));
    const currentScore = Math.max(0, Math.floor(Number(body.currentScore || 0)));
    const wave = Math.max(1, Math.floor(Number(body.wave || 1)));
    const upgrades = body.upgrades && typeof body.upgrades === "object" ? body.upgrades : {};

    const sql = getSql();
    const rows = rowsOf(await sql`
      insert into vanishoot_saves (user_id, gold, upgrades, best_score, best_wave, total_runs)
      values (${userId}, ${gold}, ${JSON.stringify(upgrades)}::jsonb, ${currentScore}, ${wave}, 0)
      on conflict (user_id) do update
        set gold = excluded.gold,
            upgrades = excluded.upgrades,
            best_score = greatest(vanishoot_saves.best_score, excluded.best_score),
            best_wave = greatest(vanishoot_saves.best_wave, excluded.best_wave),
            updated_at = now()
      returning gold, upgrades, best_score, best_wave, total_runs, updated_at
    `);

    return NextResponse.json({ save: rows[0] });
  } catch (error) {
    if (error instanceof MissingDatabaseUrlError) {
      return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: "Save update failed" }, { status: 500 });
  }
}
