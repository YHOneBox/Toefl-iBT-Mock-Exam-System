import { NextResponse } from "next/server";
import { failAuth, requireUser } from "@/lib/auth";
import { listGeminiModels, saveGeminiAvailable } from "@/lib/gemini";

export async function GET() {
  try {
    await requireUser();
  } catch (err) {
    return failAuth(err) ?? NextResponse.json({ error: "Failed" }, { status: 500 });
  }
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "Add GEMINI_API_KEY to .env, then scan again." },
      { status: 400 },
    );
  }
  try {
    const models = await listGeminiModels(key);
    const settings = await saveGeminiAvailable(models);
    return NextResponse.json({
      models,
      settings,
      suggested: settings.chain,
      keyPresent: true,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not list Gemini models" },
      { status: 500 },
    );
  }
}
