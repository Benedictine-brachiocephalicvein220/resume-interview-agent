"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
  error?: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ScoreCardData = {
  totalScore?: string;
  clarityScore?: string;
  relevanceScore?: string;
  completenessScore?: string;
  structureScore?: string;
  strengths?: string[];
  weaknesses?: string[];
  suggestions?: string[];
  sampleAnswer?: string;
  nextStep?: string;
};

type SummaryReportData = {
  overallEvaluation?: string;
  overallScore?: string;
  highlights?: string[];
  problems?: string[];
  prioritySkills?: string[];
  improvementSuggestions?: string[];
  nextRoundSuggestion?: string;
};

const STORAGE_KEYS = {
  jd: "resume-agent-jd",
  result: "resume-agent-result",
  messages: "resume-agent-messages",
  interviewerMode: "resume-agent-interviewer-mode",
};

const DEFAULT_ASSISTANT_MESSAGE: ChatMessage = {
  role: "assistant",
  content:
    "你好，我是你的 AI 面试助手。你可以让我模拟面试、点评你的回答，或者结合岗位 JD 帮你准备面试。",
};

function parseBulletSection(section: string): string[] {
  return section
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[-•\d.\s]+/, "").trim())
    .filter(Boolean);
}

function parseScoreCard(content: string): ScoreCardData | null {
  if (!content.includes("【评分】")) return null;

  const getSection = (title: string, nextTitles: string[]) => {
    const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const nextPattern = nextTitles
      .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|");

    const regex = new RegExp(
      `【${escapedTitle}】([\\s\\S]*?)(?=【(?:${nextPattern})】|$)`
    );

    const match = content.match(regex);
    return match?.[1]?.trim() || "";
  };

  const scoreSection = getSection("评分", [
    "回答优点",
    "主要不足",
    "改进建议",
    "参考回答",
    "下一步",
  ]);

  const strengthsSection = getSection("回答优点", [
    "主要不足",
    "改进建议",
    "参考回答",
    "下一步",
  ]);

  const weaknessesSection = getSection("主要不足", [
    "改进建议",
    "参考回答",
    "下一步",
  ]);

  const suggestionsSection = getSection("改进建议", [
    "参考回答",
    "下一步",
  ]);

  const sampleAnswerSection = getSection("参考回答", ["下一步"]);
  const nextStepSection = getSection("下一步", []);

  const totalScore = scoreSection.match(/总分[:：]\s*([^\n]+)/)?.[1]?.trim();
  const clarityScore = scoreSection
    .match(/表达清晰度[:：]\s*([^\n]+)/)?.[1]
    ?.trim();
  const relevanceScore = scoreSection
    .match(/岗位匹配度[:：]\s*([^\n]+)/)?.[1]
    ?.trim();
  const completenessScore = scoreSection
    .match(/内容完整度[:：]\s*([^\n]+)/)?.[1]
    ?.trim();
  const structureScore = scoreSection
    .match(/逻辑结构[:：]\s*([^\n]+)/)?.[1]
    ?.trim();

  return {
    totalScore,
    clarityScore,
    relevanceScore,
    completenessScore,
    structureScore,
    strengths: parseBulletSection(strengthsSection),
    weaknesses: parseBulletSection(weaknessesSection),
    suggestions: parseBulletSection(suggestionsSection),
    sampleAnswer: sampleAnswerSection || undefined,
    nextStep: nextStepSection || undefined,
  };
}

function parseSummaryReport(content: string): SummaryReportData | null {
  if (!content.includes("【面试总结报告】")) return null;

  const getSection = (title: string, nextTitles: string[]) => {
    const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const nextPattern = nextTitles
      .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|");

    const regex = new RegExp(
      `【${escapedTitle}】([\\s\\S]*?)(?=【(?:${nextPattern})】|$)`
    );

    const match = content.match(regex);
    return match?.[1]?.trim() || "";
  };

  const reportHeader = getSection("面试总结报告", [
    "表现亮点",
    "主要问题",
    "最该优先补的能力",
    "后续改进建议",
    "下一轮建议",
  ]);

  const highlightsSection = getSection("表现亮点", [
    "主要问题",
    "最该优先补的能力",
    "后续改进建议",
    "下一轮建议",
  ]);

  const problemsSection = getSection("主要问题", [
    "最该优先补的能力",
    "后续改进建议",
    "下一轮建议",
  ]);

  const skillsSection = getSection("最该优先补的能力", [
    "后续改进建议",
    "下一轮建议",
  ]);

  const suggestionsSection = getSection("后续改进建议", ["下一轮建议"]);
  const nextRoundSection = getSection("下一轮建议", []);

  const overallEvaluation = reportHeader
    .match(/总体评价[:：]\s*([^\n]+)/)?.[1]
    ?.trim();

  const overallScore = reportHeader
    .match(/综合得分[:：]\s*([^\n]+)/)?.[1]
    ?.trim();

  return {
    overallEvaluation,
    overallScore,
    highlights: parseBulletSection(highlightsSection),
    problems: parseBulletSection(problemsSection),
    prioritySkills: parseBulletSection(skillsSection),
    improvementSuggestions: parseBulletSection(suggestionsSection),
    nextRoundSuggestion: nextRoundSection || undefined,
  };
}

function ScoreMetricCard({
  label,
  value,
}: {
  label: string;
  value?: string;
}) {
  if (!value) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-lg font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function ScoreCard({ data }: { data: ScoreCardData }) {
  return (
    <div className="mt-3 overflow-hidden rounded-3xl border border-indigo-200 bg-indigo-50/60">
      <div className="border-b border-indigo-200 bg-white/70 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-slate-900">面试回答评分</h4>
            <p className="mt-1 text-xs text-slate-500">
              基于当前回答生成的结构化评估结果
            </p>
          </div>

          {data.totalScore ? (
            <div className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm">
              总分：{data.totalScore}
            </div>
          ) : null}
        </div>
      </div>

      <div className="space-y-5 p-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <ScoreMetricCard label="表达清晰度" value={data.clarityScore} />
          <ScoreMetricCard label="岗位匹配度" value={data.relevanceScore} />
          <ScoreMetricCard label="内容完整度" value={data.completenessScore} />
          <ScoreMetricCard label="逻辑结构" value={data.structureScore} />
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h5 className="text-sm font-semibold text-slate-900">回答优点</h5>
            {data.strengths?.length ? (
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                {data.strengths.map((item, index) => (
                  <li key={index} className="rounded-xl bg-slate-50 px-3 py-2">
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-500">暂无</p>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h5 className="text-sm font-semibold text-slate-900">主要不足</h5>
            {data.weaknesses?.length ? (
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                {data.weaknesses.map((item, index) => (
                  <li key={index} className="rounded-xl bg-slate-50 px-3 py-2">
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-500">暂无</p>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h5 className="text-sm font-semibold text-slate-900">改进建议</h5>
            {data.suggestions?.length ? (
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                {data.suggestions.map((item, index) => (
                  <li key={index} className="rounded-xl bg-slate-50 px-3 py-2">
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-500">暂无</p>
            )}
          </div>
        </div>

        {data.sampleAnswer ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h5 className="text-sm font-semibold text-slate-900">参考回答</h5>
            <div className="mt-3 whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-700">
              {data.sampleAnswer}
            </div>
          </div>
        ) : null}

        {data.nextStep ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h5 className="text-sm font-semibold text-slate-900">下一步</h5>
            <div className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-700">
              {data.nextStep}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SummaryReportCard({ data }: { data: SummaryReportData }) {
  return (
    <div className="mt-3 overflow-hidden rounded-3xl border border-emerald-200 bg-emerald-50/70">
      <div className="border-b border-emerald-200 bg-white/80 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-slate-900">面试总结报告</h4>
            <p className="mt-1 text-xs text-slate-500">
              基于整轮面试表现生成的复盘结果
            </p>
          </div>

          {data.overallScore ? (
            <div className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm">
              综合得分：{data.overallScore}
            </div>
          ) : null}
        </div>
      </div>

      <div className="space-y-5 p-5">
        {data.overallEvaluation ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h5 className="text-sm font-semibold text-slate-900">总体评价</h5>
            <div className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-700">
              {data.overallEvaluation}
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h5 className="text-sm font-semibold text-slate-900">表现亮点</h5>
            {data.highlights?.length ? (
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                {data.highlights.map((item, index) => (
                  <li key={index} className="rounded-xl bg-slate-50 px-3 py-2">
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-500">暂无</p>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h5 className="text-sm font-semibold text-slate-900">主要问题</h5>
            {data.problems?.length ? (
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                {data.problems.map((item, index) => (
                  <li key={index} className="rounded-xl bg-slate-50 px-3 py-2">
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-500">暂无</p>
            )}
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h5 className="text-sm font-semibold text-slate-900">
              最该优先补的能力
            </h5>
            {data.prioritySkills?.length ? (
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                {data.prioritySkills.map((item, index) => (
                  <li key={index} className="rounded-xl bg-slate-50 px-3 py-2">
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-500">暂无</p>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h5 className="text-sm font-semibold text-slate-900">
              后续改进建议
            </h5>
            {data.improvementSuggestions?.length ? (
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                {data.improvementSuggestions.map((item, index) => (
                  <li key={index} className="rounded-xl bg-slate-50 px-3 py-2">
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-500">暂无</p>
            )}
          </div>
        </div>

        {data.nextRoundSuggestion ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h5 className="text-sm font-semibold text-slate-900">下一轮建议</h5>
            <div className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-700">
              {data.nextRoundSuggestion}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AssistantMessage({ content }: { content: string }) {
  const scoreCardData = useMemo(() => parseScoreCard(content), [content]);
  const summaryReportData = useMemo(() => parseSummaryReport(content), [content]);

  if (summaryReportData) {
    return (
      <div>
        <div className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-800">
          {content}
        </div>
        <SummaryReportCard data={summaryReportData} />
      </div>
    );
  }

  if (scoreCardData) {
    return (
      <div>
        <div className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-800">
          {content}
        </div>
        <ScoreCard data={scoreCardData} />
      </div>
    );
  }

  return (
    <div className="whitespace-pre-wrap break-words text-sm leading-7">
      {content}
    </div>
  );
}

export default function Home() {
  const [jd, setJd] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [messages, setMessages] = useState<ChatMessage[]>([
    DEFAULT_ASSISTANT_MESSAGE,
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [interviewerMode, setInterviewerMode] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const chatContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const savedJd = localStorage.getItem(STORAGE_KEYS.jd);
      const savedResult = localStorage.getItem(STORAGE_KEYS.result);
      const savedMessages = localStorage.getItem(STORAGE_KEYS.messages);
      const savedInterviewerMode = localStorage.getItem(
        STORAGE_KEYS.interviewerMode
      );

      if (savedJd) {
        setJd(savedJd);
      }

      if (savedResult) {
        setResult(JSON.parse(savedResult));
      }

      if (savedMessages) {
        const parsedMessages = JSON.parse(savedMessages) as ChatMessage[];
        if (Array.isArray(parsedMessages) && parsedMessages.length > 0) {
          setMessages(parsedMessages);
        }
      }

      if (savedInterviewerMode) {
        setInterviewerMode(savedInterviewerMode === "true");
      }
    } catch (err) {
      console.error("读取本地缓存失败:", err);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEYS.jd, jd);
  }, [jd, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEYS.result, JSON.stringify(result));
  }, [result, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEYS.messages, JSON.stringify(messages));
  }, [messages, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(
      STORAGE_KEYS.interviewerMode,
      String(interviewerMode)
    );
  }, [interviewerMode, hydrated]);

  const handleAnalyze = async () => {
    setError("");
    setResult(null);

    if (!jd.trim()) {
      setError("请先输入岗位 JD");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jobDescription: jd,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "请求失败");
        setResult(null);
      } else {
        setResult(data);
      }
    } catch {
      setError("请求失败，请检查服务是否正常");
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || chatLoading) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: chatInput.trim(),
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setChatInput("");
    setChatLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: nextMessages,
          jobDescription: jd,
          analysisResult: result,
          interviewerMode,
          summaryMode: false,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessages([
          ...nextMessages,
          {
            role: "assistant",
            content: data.error || "对话请求失败，请稍后再试。",
          },
        ]);
        return;
      }

      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: data.reply || "模型没有返回内容。",
        },
      ]);
    } catch {
      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: "对话请求失败，请检查服务是否正常。",
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleStartInterview = async () => {
    if (chatLoading) return;

    const startMessage: ChatMessage = {
      role: "user",
      content: "开始面试",
    };

    const nextMessages = [...messages, startMessage];
    setMessages(nextMessages);
    setChatLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: nextMessages,
          jobDescription: jd,
          analysisResult: result,
          interviewerMode: true,
          summaryMode: false,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessages([
          ...nextMessages,
          {
            role: "assistant",
            content: data.error || "开启面试失败，请稍后再试。",
          },
        ]);
        return;
      }

      setInterviewerMode(true);
      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: data.reply || "模型没有返回内容。",
        },
      ]);
    } catch {
      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: "开启面试失败，请检查服务是否正常。",
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleGenerateSummary = async () => {
    if (chatLoading || messages.length < 2) return;

    const summaryTriggerMessage: ChatMessage = {
      role: "user",
      content: "请基于这轮面试对话生成总结报告。",
    };

    const nextMessages = [...messages, summaryTriggerMessage];
    setMessages(nextMessages);
    setChatLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: nextMessages,
          jobDescription: jd,
          analysisResult: result,
          interviewerMode: true,
          summaryMode: true,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessages([
          ...nextMessages,
          {
            role: "assistant",
            content: data.error || "生成总结报告失败，请稍后再试。",
          },
        ]);
        return;
      }

      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: data.reply || "模型没有返回内容。",
        },
      ]);
    } catch {
      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: "生成总结报告失败，请检查服务是否正常。",
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleResetChat = () => {
    setMessages([DEFAULT_ASSISTANT_MESSAGE]);
    setInterviewerMode(false);
    localStorage.removeItem(STORAGE_KEYS.messages);
    localStorage.removeItem(STORAGE_KEYS.interviewerMode);
  };

  const handleClearAllData = () => {
    setJd("");
    setResult(null);
    setError("");
    setMessages([DEFAULT_ASSISTANT_MESSAGE]);
    setInterviewerMode(false);
    setChatInput("");

    localStorage.removeItem(STORAGE_KEYS.jd);
    localStorage.removeItem(STORAGE_KEYS.result);
    localStorage.removeItem(STORAGE_KEYS.messages);
    localStorage.removeItem(STORAGE_KEYS.interviewerMode);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, chatLoading]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-[1800px] px-6 py-8 xl:px-8">
        <div className="mb-8 rounded-3xl border border-slate-200 bg-white px-8 py-7 shadow-sm">
          <div className="space-y-3">
            <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-600">
              Resume Interview Agent
            </span>
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
              Resume Interview Agent
            </h1>
            <p className="max-w-4xl text-base leading-7 text-slate-600 md:text-lg">
              输入岗位 JD，获得结构化分析；再通过右侧更大的 AI 对话工作区进行面试模拟、
              回答优化、多轮追问和面试官模式训练。
            </p>
            <p className="text-sm text-slate-500">
              当前版本已支持本地持久化：刷新页面后会保留 JD、分析结果和聊天记录。
            </p>
          </div>
        </div>

        <div className="grid gap-8 xl:grid-cols-[0.88fr_1.32fr]">
          <div className="space-y-8">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-semibold">输入岗位信息</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    粘贴目标岗位 JD，先生成结构化分析结果，再把结果注入右侧 AI 面试流程。
                  </p>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="jd"
                    className="text-sm font-medium text-slate-700"
                  >
                    Job Description
                  </label>
                  <textarea
                    id="jd"
                    className="min-h-[260px] w-full rounded-3xl border border-slate-300 px-4 py-4 text-sm leading-7 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                    placeholder="Paste JD here..."
                    value={jd}
                    onChange={(e) => setJd(e.target.value)}
                  />
                </div>

                {error ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handleAnalyze}
                    disabled={loading}
                    className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {loading ? "分析中..." : "开始分析"}
                  </button>

                  <button
                    onClick={handleClearAllData}
                    className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                  >
                    清空全部数据
                  </button>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="space-y-3">
                <h2 className="text-xl font-semibold">当前能力</h2>
                <ul className="space-y-3 text-sm text-slate-600">
                  <li className="rounded-2xl bg-slate-50 p-4">1. 识别岗位关键词</li>
                  <li className="rounded-2xl bg-slate-50 p-4">2. 生成匹配度分数</li>
                  <li className="rounded-2xl bg-slate-50 p-4">3. 给出简历差距分析</li>
                  <li className="rounded-2xl bg-slate-50 p-4">4. 输出面试问题和回答提示</li>
                  <li className="rounded-2xl bg-slate-50 p-4">5. 支持多轮对话式面试准备</li>
                  <li className="rounded-2xl bg-slate-50 p-4">6. 支持岗位定制化面试官模式</li>
                  <li className="rounded-2xl bg-slate-50 p-4">7. 支持结构化评分反馈</li>
                  <li className="rounded-2xl bg-slate-50 p-4">8. 支持整轮面试总结报告</li>
                  <li className="rounded-2xl bg-slate-50 p-4">9. 支持本地对话持久化</li>
                </ul>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold">分析结果</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    这些结果会被注入右侧对话上下文，驱动更贴近岗位的模拟面试。
                  </p>
                </div>
                <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">
                  {loading
                    ? "Analyzing"
                    : result
                    ? "Result Ready"
                    : "Waiting for Input"}
                </div>
              </div>

              {!result && !loading ? (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center text-sm text-slate-500">
                  输入岗位 JD 后点击“开始分析”，这里会显示结构化结果。
                </div>
              ) : null}

              {loading ? (
                <div className="rounded-3xl bg-slate-50 px-6 py-14 text-center text-sm text-slate-500">
                  正在分析岗位需求...
                </div>
              ) : null}

              {result ? (
                <div className="space-y-8">
                  <div className="grid gap-4 md:grid-cols-[1fr_190px]">
                    <div className="rounded-3xl bg-slate-50 p-5">
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                        Job Keywords
                      </h3>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {result.jobKeywords?.map((keyword) => (
                          <span
                            key={keyword}
                            className="rounded-full bg-white px-3 py-1.5 text-sm text-slate-700 ring-1 ring-slate-200"
                          >
                            {keyword}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-3xl bg-slate-900 p-5 text-white">
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                        Match Score
                      </h3>
                      <div className="mt-4 text-4xl font-bold">
                        {result.matchScore}
                        <span className="text-xl text-slate-300">/100</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-6 2xl:grid-cols-2">
                    <div className="rounded-3xl bg-slate-50 p-5">
                      <h3 className="text-lg font-semibold">Gap Analysis</h3>
                      <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-700">
                        {result.gapAnalysis?.map((item) => (
                          <li
                            key={item}
                            className="rounded-2xl bg-white p-4 ring-1 ring-slate-200"
                          >
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="rounded-3xl bg-slate-50 p-5">
                      <h3 className="text-lg font-semibold">
                        Improved Resume Bullets
                      </h3>
                      <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-700">
                        {result.improvedBullets?.map((item) => (
                          <li
                            key={item}
                            className="rounded-2xl bg-white p-4 ring-1 ring-slate-200"
                          >
                            • {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="rounded-3xl bg-slate-50 p-5">
                    <h3 className="text-lg font-semibold">Interview Questions</h3>
                    <div className="mt-4 space-y-4">
                      {result.interviewQuestions?.map((item) => (
                        <div
                          key={item.question}
                          className="rounded-2xl bg-white p-4 ring-1 ring-slate-200"
                        >
                          <p className="font-medium text-slate-900">
                            {item.question}
                          </p>
                          <p className="mt-2 text-sm text-slate-600">
                            <span className="font-medium text-slate-800">
                              考察意图：
                            </span>
                            {item.intent}
                          </p>
                          <p className="mt-1 text-sm text-slate-600">
                            <span className="font-medium text-slate-800">
                              回答提示：
                            </span>
                            {item.answerHint}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </section>
          </div>

          <section className="flex h-[900px] min-w-0 flex-col rounded-3xl border border-slate-200 bg-white shadow-sm 2xl:h-[960px]">
            <div className="border-b border-slate-200 px-7 py-5">
              <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-start 2xl:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold">AI 面试工作区</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    这里是主交互区。你可以自由提问，也可以切换到面试官模式进行更有节奏的模拟面试。
                  </p>
                </div>

                <button
                  onClick={() => setInterviewerMode((prev) => !prev)}
                  className={`rounded-2xl px-4 py-2.5 text-sm font-medium transition ${
                    interviewerMode
                      ? "bg-slate-900 text-white"
                      : "border border-slate-300 bg-white text-slate-700"
                  }`}
                >
                  {interviewerMode ? "面试官模式已开启" : "开启面试官模式"}
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={handleStartInterview}
                  disabled={chatLoading}
                  className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  开始模拟面试
                </button>

                <button
                  onClick={handleGenerateSummary}
                  disabled={chatLoading || messages.length < 2}
                  className="rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300"
                >
                  生成总结报告
                </button>

                <button
                  onClick={handleResetChat}
                  disabled={chatLoading}
                  className="rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                >
                  清空对话
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden bg-slate-50 p-5">
              <div
                ref={chatContainerRef}
                className="h-full space-y-4 overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5"
              >
                {messages.map((message, index) => {
                  const isUser = message.role === "user";

                  return (
                    <div
                      key={`${message.role}-${index}`}
                      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[92%] rounded-3xl px-5 py-4 text-sm leading-7 shadow-sm ${
                          isUser
                            ? "bg-slate-900 text-white"
                            : "border border-slate-200 bg-slate-50 text-slate-800"
                        }`}
                      >
                        <div className="mb-1.5 text-xs font-medium opacity-70">
                          {isUser ? "你" : "AI 面试助手"}
                        </div>

                        {isUser ? (
                          <div className="whitespace-pre-wrap break-words text-sm leading-7">
                            {message.content}
                          </div>
                        ) : (
                          <AssistantMessage content={message.content} />
                        )}
                      </div>
                    </div>
                  );
                })}

                {chatLoading ? (
                  <div className="flex justify-start">
                    <div className="max-w-[92%] rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-500 shadow-sm">
                      <div className="mb-1.5 text-xs font-medium opacity-70">
                        AI 面试助手
                      </div>
                      正在思考中...
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="border-t border-slate-200 bg-white p-5">
              <div className="space-y-3">
                <textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="输入你的问题，例如：请根据这个岗位开始一轮前端面试 / 我这样回答可以吗？"
                  className="min-h-[140px] w-full rounded-3xl border border-slate-300 px-5 py-4 text-sm leading-7 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />

                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-slate-500">
                    Enter 发送，Shift + Enter 换行
                  </p>

                  <button
                    onClick={handleSendMessage}
                    disabled={chatLoading || !chatInput.trim() || !hydrated}
                    className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {chatLoading ? "发送中..." : "发送"}
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}