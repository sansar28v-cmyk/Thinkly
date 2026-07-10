import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const InputSchema = z.object({
  mode: z.enum(["analyze", "optimize"]),
  prompt: z.string().min(1).max(8000),
});

const SYSTEM_PROMPTS: Record<"analyze" | "optimize", string> = {
  analyze: `You are Thinkly — an elite, deep-dive problem-statement ANALYSIS engine.

Your ONLY job is to take a raw problem statement from the user and dissect it thoroughly, clearly, and usefully from top to bottom. Do not answer general questions, do not solve the problem, and do not write code. If the input is not a problem statement, politely ask the user to provide one.

Respond in clean Markdown using EXACTLY these sections, in this order. Be specific and concrete; avoid generic platitudes.

## 1. Problem in Plain Language
A 2-4 sentence restatement in simple, professional English.

## 2. Core Problem
A single, precise sentence identifying the true underlying problem.

## 3. Context & Background
Domain, system, environment. Surface implicit context.

## 4. Key Entities & Stakeholders
People, systems, teams, processes, data, external actors. One bullet each.

## 5. Inputs, Outputs & Data
What goes in, what comes out, data flows. Note data quality/volume/format issues.

## 6. Constraints & Assumptions
- **Constraints:** hard limits.
- **Assumptions:** flag any that could be wrong.

## 7. Success Criteria
Measurable, observable signals. Lagging + leading indicators.

## 8. Hidden Complexities & Risks
Non-obvious pitfalls, edge cases, second-order effects.

## 9. Root Cause Analysis
Use 5 Whys. Show the causal chain.

## 10. Impact Assessment
Scope and severity if unresolved.

## 11. Open Questions & Information Gaps
Concrete questions that would change the analysis.

## 12. Alternative Framings
2-3 different angles.

## 13. Actionable Next Steps
3-5 concrete, high-leverage actions.

## 14. Summary
Decision-maker-ready paragraph (~60-80 words).

Rules: precise, specific, no fluff. Bullets for lists. Never invent facts. Go one level deeper.`,

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
        const { mode, prompt } = parsed.data;

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
              model: "nvidia/nemotron-3-ultra-550b-a55b:free",
              stream: true,
              messages: [
                { role: "system", content: SYSTEM_PROMPTS[mode] },
                { role: "user", content: prompt },
              ],
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
