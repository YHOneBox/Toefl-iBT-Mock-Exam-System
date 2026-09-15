import { NextResponse } from "next/server";
import { failAuth, requireUser } from "@/lib/auth";
import { geminiKeys, hasGeminiKey } from "@/lib/gemini-keys";
import { listGeminiModels, loadGeminiSettings, saveGeminiAvailable } from "@/lib/gemini";

export async function GET() {
  try {
    const user = await requireUser();
    if (!hasGeminiKey()) {
      return NextResponse.json(
        { error: "Add GEMINI_API_KEY to .env, then scan again." },
        { status: 400 },
      );
    }
    const errors: string[] = [];
    let models: Awaited<ReturnType<typeof listGeminiModels>> = [];
    for (const entry of geminiKeys()) {
      try {
        models = await listGeminiModels(entry.key);
        if (models.length) break;
      } catch (err) {
        errors.push(`${entry.label}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    if (!models.length) {
      throw new Error(errors[0] || "Could not list Gemini models");
    }
    await saveGeminiAvailable(models);
    const settings = await loadGeminiSettings(user.id);
    return NextResponse.json({
      models,
      settings,
      suggested: settings.chain,
      keyPresent: true,
    });
  } catch (err) {
    return (
      failAuth(err) ??
      NextResponse.json(
        { error: err instanceof Error ? err.message : "Could not list Gemini models" },
        { status: 500 },
      )
    );
  }
}
