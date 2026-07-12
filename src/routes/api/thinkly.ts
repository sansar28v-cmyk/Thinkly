import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const InputSchema = z.object({
  mode: z.enum(["analyze", "optimize"]),
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string()
  })).min(1),
});

const SYSTEM_PROMPTS: Record<"analyze" | "optimize", string> = {
  analyze: `CRITICAL INSTRUCTION: You MUST output your entire response ONLY in English. Do NOT use Hindi, Telugu, Bengali, Georgian, Armenian, or any other languages under any circumstances.

You are Thinkly — an elite, deep-dive problem-statement ANALYSIS engine.

Your ONLY job is to take a raw problem statement from the user and dissect it thoroughly, clearly, and exhaustively from top to bottom. Do not answer general questions, do not solve the problem, and do not write code. If the input is not a problem statement, politely ask the user to provide one.

Respond in clean Markdown using EXACTLY these sections, in this order. You must provide a highly detailed, complete explanation of the problem. Be specific, deeply analytical, and concrete; avoid generic platitudes. Every section must contain a comprehensive explanation.

## 1. Executive Summary
A concise restatement of the problem in professional language.

## 2. Stakeholder Analysis
Who is affected, primary and secondary stakeholders.

## 3. Root Cause Assessment
Underlying drivers of the problem, not just symptoms.

## 4. Scope of Work
Boundaries of what is being addressed, with exclusions stated explicitly.

## 5. Competitive Landscape / Gap Analysis
Existing solutions and their shortcomings.

## 6. Constraints & Risk Factors
Technical, financial, operational, or regulatory limitations.

## 7. Feasibility Study
Low/Medium/High rating with supporting rationale.

## 8. Proposed Approach
Recommended solution direction at a strategic level.

## 9. Key Performance Indicators (KPIs)
Measurable criteria for success.

## 10. Business Impact & Value Proposition
Expected benefit and who realizes it.

Rules: precise, specific, highly detailed explanations. Bullets for lists. Never invent facts. Go several levels deeper. You MUST output your response entirely in English, with no other languages used.`,

  optimize: `CRITICAL INSTRUCTION: You MUST output your entire response ONLY in English. Do NOT use Hindi, Telugu, Bengali, Georgian, Armenian, or any other languages under any circumstances.

You are Thinkly — an elite problem-statement OPTIMIZER.

Your ONLY job is to rewrite the user's raw, messy, or informal problem into a crisp, professional, unambiguous problem statement. Do not solve the problem.

Respond in clean Markdown with EXACTLY these sections:

## Optimized Problem Statement
1-3 tight paragraphs, formal tone.

## One-Line Version
≤ 30 words.

## Scope
Bulleted list of what IS in scope.

## Out of Scope
Bulleted list of what is NOT in scope.

## Objectives & Success Metrics
Concrete, measurable.

## Key Terms
Define domain-specific terms.

## Rationale for Changes
What was vague and how it was fixed.

Rules: preserve intent, remove hedging, active voice, no code. You MUST output your response entirely in English, with no other languages used.`,
};

export const Route = createFileRoute("/api/thinkly")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
          return new Response("Missing OPENROUTER_API_KEY", { status: 500 });
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const parsed = InputSchema.safeParse(body);
        if (!parsed.success) {
          return new Response("Invalid input", { status: 400 });
        }
        const { mode, messages } = parsed.data;

        const isFollowUp = messages.length > 1;
        const systemPrompt = isFollowUp
          ? `CRITICAL INSTRUCTION: You MUST output your entire response ONLY in English. Do NOT use Hindi, Telugu, Bengali, Georgian, Armenian, or any other languages under any circumstances.\n\nYou are Thinkly. You previously provided an analysis or optimization of a problem statement. Now, the user is asking a follow-up question or doubt. Answer their specific question directly, concisely, and accurately based on the context of the previous analysis. DO NOT output the full analysis format again. Provide an exact and direct answer to the user's doubt.`
          : SYSTEM_PROMPTS[mode];

        const upstreamMessages = [
          { role: "system", content: systemPrompt },
          ...messages
        ];

        const upstream = await fetch(
          "https://openrouter.ai/api/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
              "X-Title": "Thinkly",
            },
            body: JSON.stringify({
              models: [
                "meta-llama/llama-3.2-3b-instruct:free",
                "openai/gpt-oss-20b:free"
              ],
              stream: true,
              messages: upstreamMessages,
              temperature: 0.1,
            }),
          },
        );

        if (!upstream.ok || !upstream.body) {
          const text = await upstream.text();
          return new Response(
            `OpenRouter ${upstream.status}: ${text.slice(0, 400)}`,
            { status: 502 },
          );
        }

        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            const reader = upstream.body!.getReader();
            const decoder = new TextDecoder();
            const encoder = new TextEncoder();
            let buffer = "";
            try {
              while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() ?? "";
                for (const line of lines) {
                  const trimmed = line.trim();
                  if (!trimmed.startsWith("data:")) continue;
                  const data = trimmed.slice(5).trim();
                  if (data === "[DONE]") {
                    controller.close();
                    return;
                  }
                  try {
                    const json = JSON.parse(data) as {
                      choices?: Array<{ delta?: { content?: string } }>;
                    };
                    const delta = json.choices?.[0]?.delta?.content;
                    if (delta) controller.enqueue(encoder.encode(delta));
                  } catch {
                    /* skip */
                  }
                }
              }
              controller.close();
            } catch (err) {
              controller.error(err);
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
          },
        });
      },
    },
  },
});
