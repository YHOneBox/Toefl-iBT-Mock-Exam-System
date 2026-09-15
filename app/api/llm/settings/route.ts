import { NextResponse } from "next/server";
import { failAuth, requireUser } from "@/lib/auth";
import { geminiKeyPresence } from "@/lib/gemini-keys";
import { loadGeminiSettings, saveGeminiChain } from "@/lib/gemini";
import { sttPresence } from "@/lib/stt";

export async function GET() {
  try {
    const user = await requireUser();
    const settings = await loadGeminiSettings(user.id);
    const gemini = geminiKeyPresence();
    const stt = sttPresence();
    return NextResponse.json({
      settings,
      keyPresent: gemini.primary || gemini.fallback,
      primaryKeyPresent: gemini.primary,
      fallbackKeyPresent: gemini.fallback,
      groqPresent: stt.groq,
      openaiPresent: Boolean(process.env.OPENAI_API_KEY),
    });
  } catch (err) {
    return failAuth(err) ?? NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const user = await requireUser();
    const body = (await req.json()) as { chain?: string[] };
    if (!Array.isArray(body.chain) || body.chain.length === 0) {
      return NextResponse.json({ error: "Choose at least one Gemini model" }, { status: 400 });
    }
    const settings = await saveGeminiChain(body.chain, user.id);
    return NextResponse.json({ settings });
  } catch (err) {
    return failAuth(err) ?? NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
