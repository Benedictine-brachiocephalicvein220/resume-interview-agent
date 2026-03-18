import OpenAI from "openai";
import { NextResponse } from "next/server";

const apiKey = process.env.OPENROUTER_API_KEY;

const client = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey,
  defaultHeaders: {
    "HTTP-Referer": "http://localhost:3000",
    "X-OpenRouter-Title": "Resume Interview Agent",
  },
});

type InterviewQuestion = {
  question: string;
  intent: string;
  answerHint: string;
};

type AnalysisResult = {
  jobKeywords: string[];
  matchScore: number;
  gapAnalysis: string[];
  improvedBullets: string[];
  interviewQuestions: InterviewQuestion[];
};

function extractJson(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }
  return text.slice(start, end + 1);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isValidResult(data: unknown): data is AnalysisResult {
  if (!data || typeof data !== "object") return false;

  const obj = data as Record<string, unknown>;

  return (
    isStringArray(obj.jobKeywords) &&
    typeof obj.matchScore === "number" &&
    isStringArray(obj.gapAnalysis) &&
    isStringArray(obj.improvedBullets) &&
    Array.isArray(obj.interviewQuestions)
  );
}

export async function POST(req: Request) {
  try {
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENROUTER_API_KEY is missing." },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { jobDescription } = body;

    if (!jobDescription || !jobDescription.trim()) {
      return NextResponse.json(
        { error: "Job description is required." },
        { status: 400 }
      );
    }

    const completion = await client.chat.completions.create({
      model: "meta-llama/llama-3.1-8b-instruct",
      temperature: 0.2,
      max_tokens: 350,
      messages: [
        {
          role: "system",
          content:
            "You are a professional resume and interview assistant. Return JSON only.",
        },
        {
          role: "user",
          content: `
Return ONLY valid JSON in this exact shape:
{
  "jobKeywords": string[],
  "matchScore": number,
  "gapAnalysis": string[],
  "improvedBullets": string[],
  "interviewQuestions": [
    {
      "question": string,
      "intent": string,
      "answerHint": string
    }
  ]
}

Rules:
- matchScore must be 0 to 100
- jobKeywords: 5 items
- gapAnalysis: 3 items
- improvedBullets: 3 items
- interviewQuestions: 3 items
- No markdown
- No extra explanation

Candidate:
Computer science student with React, TypeScript, frontend project, teamwork experience.

Job description:
${jobDescription}
          `.trim(),
        },
      ],
    });

    const text = completion.choices[0]?.message?.content;

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Model returned empty output." },
        { status: 500 }
      );
    }

    const jsonText = extractJson(text);

    if (!jsonText) {
      return NextResponse.json(
        { error: "Could not extract JSON from model output.", raw: text },
        { status: 500 }
      );
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(jsonText);
    } catch {
      return NextResponse.json(
        { error: "Model returned invalid JSON.", raw: text },
        { status: 500 }
      );
    }

    if (!isValidResult(parsed)) {
      return NextResponse.json(
        { error: "Model returned unexpected JSON shape.", raw: parsed },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed);
  } catch (error: any) {
    console.error("OpenRouter route error:", error);

    const status = error?.status;
    const message =
      status === 429
        ? "免费模型当前请求过多，请过一会儿再试。"
        : error?.message || "Unknown server error";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}