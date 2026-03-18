import { NextRequest, NextResponse } from "next/server";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type InterviewQuestion = {
  question?: string;
  intent?: string;
  answerHint?: string;
};

type AnalysisResult = {
  jobKeywords?: string[];
  matchScore?: number;
  gapAnalysis?: string[];
  improvedBullets?: string[];
  interviewQuestions?: InterviewQuestion[];
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const messages = body.messages as ChatMessage[] | undefined;
    const jobDescription = body.jobDescription as string | undefined;
    const analysisResult = body.analysisResult as AnalysisResult | undefined;
    const interviewerMode = Boolean(body.interviewerMode);
    const summaryMode = Boolean(body.summaryMode);

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "messages 不能为空" },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    const modelName =
      process.env.OPENROUTER_MODEL || "meta-llama/llama-3.1-8b-instruct";

    if (!apiKey) {
      return NextResponse.json(
        { error: "服务端缺少 OPENROUTER_API_KEY" },
        { status: 500 }
      );
    }

    const contextParts: string[] = [];

    if (jobDescription?.trim()) {
      contextParts.push(
        `
【当前岗位 JD】
${jobDescription.trim()}
        `.trim()
      );
    }

    if (analysisResult) {
      const keywords =
        analysisResult.jobKeywords && analysisResult.jobKeywords.length > 0
          ? analysisResult.jobKeywords.join("、")
          : "暂无";

      const matchScore =
        typeof analysisResult.matchScore === "number"
          ? `${analysisResult.matchScore}/100`
          : "暂无";

      const gapAnalysis =
        analysisResult.gapAnalysis && analysisResult.gapAnalysis.length > 0
          ? analysisResult.gapAnalysis
              .map((item, index) => `${index + 1}. ${item}`)
              .join("\n")
          : "暂无";

      const improvedBullets =
        analysisResult.improvedBullets &&
        analysisResult.improvedBullets.length > 0
          ? analysisResult.improvedBullets
              .map((item, index) => `${index + 1}. ${item}`)
              .join("\n")
          : "暂无";

      const interviewQuestions =
        analysisResult.interviewQuestions &&
        analysisResult.interviewQuestions.length > 0
          ? analysisResult.interviewQuestions
              .map(
                (item, index) =>
                  `${index + 1}. 问题：${item.question || ""}\n   考察意图：${
                    item.intent || ""
                  }\n   回答提示：${item.answerHint || ""}`
              )
              .join("\n")
          : "暂无";

      contextParts.push(
        `
【候选人分析结果】
岗位关键词：${keywords}
匹配度：${matchScore}

差距分析：
${gapAnalysis}

优化后的简历要点：
${improvedBullets}

已有面试问题：
${interviewQuestions}
        `.trim()
      );
    }

    const contextBlock =
      contextParts.length > 0
        ? `

你当前必须结合下面的上下文进行回答，不要忽略：

${contextParts.join("\n\n")}
`
        : "";

    const summaryModeInstruction = summaryMode
      ? `
你当前处于“面试总结报告模式”，必须遵守以下规则：

1. 你不是继续聊天，也不是继续提问，而是基于已有对话生成一份完整总结报告。
2. 你必须结合：
   - 当前岗位 JD
   - 分析结果
   - 整段面试对话历史
3. 总结报告必须尽量按下面结构输出：

【面试总结报告】
总体评价：...
综合得分：X/10

【表现亮点】
- ...
- ...
- ...

【主要问题】
- ...
- ...
- ...

【最该优先补的能力】
- ...
- ...
- ...

【后续改进建议】
- ...
- ...
- ...

【下一轮建议】
...

4. 不要继续出题。
5. 不要重复整段对话。
6. 总结要像真实面试复盘，简洁、专业、可执行。
7. 综合得分要真实，不要默认高分。
`
      : "";

    const interviewModeInstruction =
      interviewerMode && !summaryMode
        ? `
你当前处于“面试官模式”，必须严格遵守以下规则：

【面试流程规则】
1. 你不是普通聊天助手，而是在主持一场模拟面试。
2. 一次只问一个问题，不要一次给很多题。
3. 如果用户说“开始面试”“继续下一题”之类的话，你应该直接进入下一题。
4. 如果用户刚回答完一道题，你要优先进行评分和点评，而不是直接开启新话题。
5. 问题必须尽量贴合当前岗位 JD 和分析结果。
6. 语气要像真实面试官，专业、简洁、有节奏。

【评分规则】
当你判断用户是在“回答一道面试题”时，你必须给出结构化评分，格式尽量严格按下面输出：

【评分】
总分：X/10
表达清晰度：X/10
岗位匹配度：X/10
内容完整度：X/10
逻辑结构：X/10

【回答优点】
- ...
- ...

【主要不足】
- ...
- ...

【改进建议】
- ...
- ...

【参考回答】
...

【下一步】
用一句话说明是继续追问，还是进入下一题。

【额外要求】
1. 分数要真实，不要默认高分。
2. 如果回答比较空泛，可以给 4-6 分。
3. 如果回答不错但不够贴岗位，可以给 6-8 分。
4. 如果回答结构清晰、细节充分、贴合岗位，再给 8-9 分。
5. 一般不要轻易给 10 分。
6. “参考回答”要适合大学生/实习生身份，不要编造多年工作经历。
7. 如果用户明确不是在回答题目，而是在咨询策略、问方法、问怎么说，可以不打分，改为正常辅导回答。
`
        : `
你当前处于普通对话模式，可以正常进行面试辅导、回答优化和自由问答。
`;

    const systemPrompt: ChatMessage = {
      role: "system",
      content: `
你是一个专业的中文 AI 面试准备助手，帮助大学生和求职者进行：
1. 简历优化
2. JD 岗位要求理解
3. 面试问题准备
4. 回答修改与提升
5. 模拟面试
6. 面试复盘总结

你的回答要求：
- 默认使用中文
- 表达清晰、专业、鼓励式
- 适合校招生 / 实习生 / 缺少实习经历的同学
- 回答尽量结构化，便于用户直接用于面试准备
- 如果已经提供了岗位 JD 和分析结果，你必须优先围绕该岗位要求进行回答，不要泛泛而谈
- 你的目标不是普通聊天，而是帮助用户完成“针对目标岗位的面试准备”

${summaryModeInstruction}

${interviewModeInstruction}

${contextBlock}
      `.trim(),
    };

    const finalMessages: ChatMessage[] = [systemPrompt, ...messages];

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: modelName,
          messages: finalMessages,
          temperature: 0.5,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenRouter Chat API Error:", data);
      return NextResponse.json(
        {
          error: data?.error?.message || "OpenRouter 调用失败",
          details: data,
        },
        { status: response.status }
      );
    }

    const reply =
      data?.choices?.[0]?.message?.content?.trim() || "模型没有返回内容";

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("Chat API Error:", error);
    return NextResponse.json(
      { error: "服务器内部错误" },
      { status: 500 }
    );
  }
}