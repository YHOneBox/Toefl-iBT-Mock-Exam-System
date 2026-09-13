import { NextResponse } from "next/server";
import { failAuth, requireUser } from "@/lib/auth";
import { loadGeminiSettings, saveGeminiChain } from "@/lib/gemini";

export async function GET() {
  try {
    await requireUser();
  } catch (err) {
    return failAuth(err) ?? NextResponse.json({ error: "Failed" }, { status: 500 });
  }
  const settings = await loadGeminiSettings();
  return NextResponse.json({
    settings,
    keyPresent: Boolean(process.env.GEMINI_API_KEY),
    openaiPresent: Boolean(process.env.OPENAI_API_KEY),
  });
}

export async function PUT(req: Request) {
  try {
    await requireUser();
  } catch (err) {
    return failAuth(err) ?? NextResponse.json({ error: "Failed" }, { status: 500 });
  }
  const body = (await req.json()) as { chain?: string[] };
  if (!Array.isArray(body.chain) || body.chain.length === 0) {
    return NextResponse.json({ error: "Choose at least one Gemini model" }, { status: 400 });
  }
  const settings = await saveGeminiChain(body.chain);
  return NextResponse.json({ settings });
}
