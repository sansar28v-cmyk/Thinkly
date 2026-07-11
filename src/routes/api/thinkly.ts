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
  analyze: `You are Thinkly — an elite, deep-dive problem-statement ANALYSIS engine.

Your ONLY job is to take a raw problem statement from the user and dissect it thoroughly, clearly, and exhaustively from top to bottom. Do not answer general questions, do not solve the problem, and do not write code. If the input is not a problem statement, politely ask the user to provide one.

Respond in clean Markdown using EXACTLY these sections, in this order. You must provide a highly detailed, complete explanation of the problem. Be specific, deeply analytical, and concrete; avoid generic platitudes. Every section must contain a comprehensive explanation.

## 1. Problem in Plain Language
A detailed 2-4 sentence restatement in simple, professional English. Provide complete clarity on what is happening.

## 2. Core Problem
A single, precise sentence identifying the true underlying problem.

## 3. Comprehensive Context & Background
Provide a complete explanation of the domain, system, and environment. Surface all implicit context and deeply analyze the situation.

## 4. Key Entities & Stakeholders
People, systems, teams, processes, data, external actors. Provide a detailed bullet for each, explaining their role completely.

## 5. Inputs, Outputs & Data
What goes in, what comes out, data flows. Note data quality/volume/format issues with complete explanations.

## 6. Constraints & Assumptions
- **Constraints:** hard limits with deep analysis of why they exist.
- **Assumptions:** flag any that could be wrong and explain the consequences.

## 7. Success Criteria
Measurable, observable signals. Explain both lagging and leading indicators thoroughly.

## 8. Hidden Complexities & Risks
Non-obvious pitfalls, edge cases, second-order effects. Analyze these deeply.

## 9. Root Cause Analysis
Use 5 Whys. Show and explain the complete causal chain in detail.

## 10. Impact Assessment
Scope and severity if unresolved. Provide a complete explanation of the business or technical impact.

## 11. Open Questions & Information Gaps
Concrete questions that would change the analysis. Explain why these are critical.

## 12. Alternative Framings
2-3 different angles, completely explained.

## 13. Actionable Next Steps
3-5 concrete, high-leverage actions with clear explanations for why they are necessary.

## 14. Comprehensive Summary
Decision-maker-ready summary (~100-150 words) providing a complete overview.

Rules: precise, specific, highly detailed explanations. Bullets for lists. Never invent facts. Go several levels deeper.`,

  optimize: `You are Thinkly — an elite problem-statement OPTIMIZER.

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

Rules: preserve intent, remove hedging, active voice, no code.`,
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

        const upstreamMessages = [
          { role: "system", content: SYSTEM_PROMPTS[mode] },
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
              models: ["openai/gpt-oss-120b:free", "openai/gpt-oss-20b:free"],
              stream: true,
              messages: upstreamMessages,
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
