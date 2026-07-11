import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export const Route = createFileRoute("/")({
  component: Thinkly,
});

type Mode = "analyze" | "optimize";

const MODES: {
  id: Mode;
  title: string;
  num: string;
  tag: string;
  desc: string;
  bullets: string[];
}[] = [
  {
    id: "analyze",
    title: "Analyze",
    num: "01",
    tag: "Core Feature",
    desc: "Explain a problem statement clearly from top to bottom.",
    bullets: [
      "Plain-language restatement",
      "Core problem, context, stakeholders",
      "Constraints, risks & root causes",
    ],
  },
  {
    id: "optimize",
    title: "Optimize",
    num: "02",
    tag: "Core Feature",
    desc: "Rewrite raw ideas into a spec-ready, professional problem statement.",
    bullets: [
      "Publication-ready formal tone",
      "Scope, objectives, key terms",
      "One-line headline version",
    ],
  },
];

const SAMPLES: Record<Mode, { label: string; prompt: string }[]> = {
  analyze: [
    {
      label: "Checkout drop-off",
      prompt:
        "Our users abandon checkout on mobile right after entering their shipping address. Conversion drops from 62% to 18% at that step.",
    },
    {
      label: "Warehouse delays",
      prompt:
        "Orders from our Mumbai warehouse are shipping 2 days late during weekends but on time on weekdays.",
    },
    {
      label: "Model drift",
      prompt:
        "Our fraud model's precision has been slowly falling from 0.91 to 0.74 over the last 3 months with no code changes.",
    },
  ],
  optimize: [
    {
      label: "Faster app",
      prompt: "we want to make the app faster somehow for users in india",
    },
    {
      label: "Better search",
      prompt:
        "search is kinda bad, users cant find products, maybe we can use ai or something",
    },
    {
      label: "Reduce churn",
      prompt: "too many users are leaving in the first week, we should fix that",
    },
  ],
};

function Thinkly() {
  const [mode, setMode] = useState<Mode>("analyze");
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [chatHistory, setChatHistory] = useState<{role: "user" | "assistant", content: string}[]>([]);
  const [followUp, setFollowUp] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatAnswer, setChatAnswer] = useState("");
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const outRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setError(null);
    setAnswer("");
    setChatHistory([]);
    setFollowUp("");
    setChatAnswer("");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/thinkly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, messages: [{ role: "user", content: prompt.trim() }] }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Request failed (${res.status})`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setAnswer(acc);
      }
      if (!acc) setAnswer("*(Empty response)*");
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  useEffect(() => {
    if (loading && outRef.current) {
      outRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [loading]);

  useEffect(() => {
    if (isChatLoading && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [isChatLoading]);

  async function onChatSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!followUp.trim() || isChatLoading) return;
    
    const userMessage = followUp.trim();
    setFollowUp("");
    
    const newHistory = [...chatHistory, { role: "user" as const, content: userMessage }];
    setChatHistory(newHistory);
    setIsChatLoading(true);
    setError(null);
    setChatAnswer("");
    
    const controller = new AbortController();
    abortRef.current = controller;
    
    try {
      const messagesPayload = [
        { role: "user", content: prompt },
        { role: "assistant", content: answer },
        ...newHistory
      ];
      
      const res = await fetch("/api/thinkly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, messages: messagesPayload }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Request failed (${res.status})`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setChatAnswer(acc);
      }
      setChatHistory([...newHistory, { role: "assistant" as const, content: acc || "*(Empty response)*" }]);
      setChatAnswer("");
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    } finally {
      setIsChatLoading(false);
      abortRef.current = null;
    }
  }

  async function copyAnswer() {
    if (!answer) return;
    try {
      await navigator.clipboard.writeText(answer);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* no-op */
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <Scene3D />
      <SpotlightCursor />
      <Grain />
      <Nav />

      <main className="relative z-10 mx-auto max-w-6xl px-5 pt-10 pb-24 sm:px-6">
        <Hero />

        {/* Mode selector */}
        <section id="workspace" className="mt-16 scroll-mt-24">
          <SectionLabel eyebrow="Two Cores" title="Choose what you need." />
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {MODES.map((m, i) => (
              <ModeCard
                key={m.id}
                mode={m}
                active={mode === m.id}
                onClick={() => setMode(m.id)}
                reveal={i}
              />
            ))}
          </div>
        </section>

        {/* Composer */}
        <section className="mt-8 reveal">
          <form
            onSubmit={onSubmit}
            className="glass glow-frame rounded-3xl p-5 md:p-8"
          >
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <label className="min-w-0 truncate text-[11px] uppercase tracking-[0.25em] text-primary/80">
                {mode === "analyze"
                  ? "Problem to analyze"
                  : "Raw problem statement"}
              </label>
              <span className="shrink-0 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                {prompt.length}/8000
              </span>
            </div>

            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value.slice(0, 8000))}
              placeholder={
                mode === "analyze"
                  ? "Paste or describe the problem you want Thinkly to break down…"
                  : "Paste your rough problem statement — Thinkly will rewrite it."
              }
              rows={5}
              className="mt-3 w-full resize-none rounded-xl border border-border/60 bg-background/40 p-4 text-base leading-normal md:text-[15px] md:leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-ring/40"
            />

            {/* Sample chips */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Try:
              </span>
              {SAMPLES[mode].map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => setPrompt(s.prompt)}
                  className="rounded-full border border-border bg-background/40 px-3 py-1 text-xs text-foreground/80 transition hover:border-primary/60 hover:text-primary"
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <p className="min-w-0 truncate text-xs text-muted-foreground">
                Powered by Thinkly Engine · tencent/hy3
              </p>
              <button
                type="submit"
                disabled={loading || !prompt.trim()}
                className="btn-sheen relative inline-flex shrink-0 items-center gap-2 overflow-hidden rounded-full bg-gradient-to-r from-[oklch(0.9_0.13_92)] via-[oklch(0.78_0.16_78)] to-[oklch(0.9_0.13_92)] px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_10px_40px_-10px_var(--gold)] transition disabled:cursor-not-allowed disabled:opacity-50 sm:px-6"
              >
                {loading && <Spinner />}
                <span>
                  {loading
                    ? "Thinking…"
                    : mode === "optimize"
                      ? "Optimize Statement"
                      : "Analyze Problem"}
                </span>
                {!loading && <span aria-hidden>→</span>}
              </button>
            </div>
          </form>
        </section>

        {/* Output */}
        <div ref={outRef} className="mt-8 scroll-mt-24">
          {error && (
            <div className="glass rounded-2xl border border-destructive/40 p-4 text-sm text-destructive-foreground">
              {error}
            </div>
          )}
          {loading && !answer && <SkeletonAnswer />}
          {!loading && !answer && !error && <EmptyState mode={mode} />}
          {answer && (
            <div className="flex flex-col gap-6">
              <article className="glass glow-frame rounded-3xl p-5 md:p-8 animate-fade-in">
                <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                  <div className="flex min-w-0 items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-primary/80">
                    <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary shadow-[0_0_10px_var(--gold)]" />
                    <span className="truncate">Thinkly · {mode}</span>
                  </div>
                  <button
                    onClick={copyAnswer}
                    className="shrink-0 rounded-full border border-border bg-background/40 px-3 py-1 text-xs text-foreground/80 transition hover:border-primary/60 hover:text-primary"
                  >
                    {copied ? "Copied ✓" : "Copy"}
                  </button>
                </div>
                <div className="prose-thinkly max-w-none text-[15px] text-foreground/95">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{answer}</ReactMarkdown>
                </div>
              </article>
              
              {/* Chat History */}
              {chatHistory.length > 0 && (
                <div className="flex flex-col gap-4 animate-fade-in">
                  {chatHistory.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] rounded-2xl p-4 md:p-5 ${msg.role === "user" ? "bg-primary text-primary-foreground" : "glass glow-frame"}`}>
                        <div className="prose-thinkly max-w-none text-[14px] md:text-[15px]">
                          {msg.role === "user" ? msg.content : <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Chat loading animation */}
              {isChatLoading && !chatAnswer && (
                <div className="flex justify-start animate-fade-in">
                  <div className="max-w-[85%] rounded-2xl p-4 md:p-5 glass glow-frame flex items-center gap-3 text-muted-foreground">
                    <Spinner />
                    <span className="text-[14px] font-medium">Generating...</span>
                  </div>
                </div>
              )}
              
              {/* Currently streaming chat answer */}
              {chatAnswer && (
                <div className="flex justify-start animate-fade-in">
                  <div className="max-w-[85%] rounded-2xl p-4 md:p-5 glass glow-frame">
                    <div className="prose-thinkly max-w-none text-[14px] md:text-[15px]">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{chatAnswer}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Chat Input */}
              <form onSubmit={onChatSubmit} className="mt-2 relative">
                <input
                  type="text"
                  value={followUp}
                  onChange={(e) => setFollowUp(e.target.value)}
                  placeholder="Ask a follow-up question..."
                  disabled={isChatLoading || loading}
                  className="w-full rounded-full border border-border/60 bg-background/40 py-3 pl-5 pr-12 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-ring/40 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={isChatLoading || loading || !followUp.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-primary/20 p-2 text-primary hover:bg-primary/30 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                </button>
              </form>
              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        <HowItWorks />
        <FeatureStrip />
      </main>
      <Footer />
    </div>
  );
}

/* -------------------- Nav -------------------- */
const NAV_ITEMS: { id: string; label: string }[] = [
  { id: "workspace", label: "Workspace" },
  { id: "how", label: "How it works" },
  { id: "features", label: "Why Thinkly" },
];

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState<string>("top");
  const [progress, setProgress] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const linkRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const [pill, setPill] = useState<{ left: number; width: number; opacity: number }>({
    left: 0,
    width: 0,
    opacity: 0,
  });

  // Scroll: rAF-throttled, only setState when the boundary actually changes.
  useEffect(() => {
    let ticking = false;
    let lastScrolled = false;
    let lastProgress = 0;
    const compute = () => {
      ticking = false;
      const y = window.scrollY;
      const isScrolled = y > 16;
      if (isScrolled !== lastScrolled) {
        lastScrolled = isScrolled;
        setScrolled(isScrolled);
      }
      const max = Math.max(
        1,
        document.documentElement.scrollHeight - window.innerHeight,
      );
      const p = Math.min(1, Math.max(0, y / max));
      // only update when it moves at least ~1%
      if (Math.abs(p - lastProgress) > 0.008) {
        lastProgress = p;
        setProgress(p);
      }
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(compute);
      }
    };
    compute();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const ids = ["top", "workspace", "how", "features"];
    const els = ids
      .map((id) => document.getElementById(id))
      .filter((n): n is HTMLElement => !!n);
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(e.target.id);
        });
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  // Position the sliding pill under the active nav link (desktop only).
  useEffect(() => {
    const update = () => {
      const el = linkRefs.current[active];
      const container = el?.parentElement;
      if (!el || !container) {
        setPill((p) => ({ ...p, opacity: 0 }));
        return;
      }
      const cRect = container.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      setPill({ left: r.left - cRect.left, width: r.width, opacity: 1 });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [active]);

  // Close mobile menu on scroll, click outside, or resize to desktop.
  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    const onScroll = () => {
      if (window.scrollY > 120) close();
    };
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <header
      ref={navRef}
      className="sticky top-3 z-30 mx-auto mt-3 max-w-6xl px-3 sm:px-6"
    >
      {/* soft gold aura behind the pill on scroll */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-x-8 -top-2 h-14 rounded-full blur-2xl transition-opacity duration-500 ${
          scrolled ? "opacity-70" : "opacity-0"
        }`}
        style={{
          background:
            "radial-gradient(60% 100% at 50% 50%, oklch(0.82 0.15 88 / 0.35), transparent 70%)",
        }}
      />
      <div className="relative w-full">
        <div
          className={`gpu glow-frame relative w-full grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 overflow-hidden rounded-full border border-border/70 px-4 py-2.5 transition-[background-color,box-shadow,backdrop-filter,border-color] duration-300 sm:px-5 ${
          scrolled
            ? "bg-background/70 backdrop-blur-xl shadow-[0_18px_50px_-20px_oklch(0.82_0.15_88/_0.45)]"
            : "bg-background/30 backdrop-blur-md"
        }`}
      >
        {/* Reading-progress hairline along the bottom of the nav pill */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px overflow-hidden"
        >
          <div
            className="gpu h-full origin-left bg-gradient-to-r from-transparent via-primary to-transparent"
            style={{
              transform: `scaleX(${progress})`,
              opacity: scrolled ? 0.9 : 0.35,
              transition: "opacity 300ms ease",
            }}
          />
        </div>

        <a href="#top" className="group flex min-w-0 items-center gap-2.5">
          <span className="relative shrink-0">
            {/* rotating gold ring behind logo */}
            <span
              aria-hidden
              className="gpu absolute -inset-1 rounded-full opacity-70 [background:conic-gradient(from_0deg,oklch(0.82_0.15_88/_0.7),transparent_40%,oklch(0.55_0.14_155/_0.6),transparent_75%,oklch(0.82_0.15_88/_0.7))] blur-[2px]"
              style={{
                animation: "spin 12s linear infinite",
                maskImage:
                  "radial-gradient(circle, transparent 55%, black 58%)",
                WebkitMaskImage:
                  "radial-gradient(circle, transparent 55%, black 58%)",
              }}
            />
            <Logo className="relative h-9 w-9 drop-shadow-[0_4px_14px_oklch(0.82_0.15_88/_0.45)] transition-transform duration-300 group-hover:rotate-[8deg]" />
          </span>
          <div className="min-w-0 leading-none">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-base font-semibold tracking-tight text-gradient-gold">
                Thinkly
              </span>
              <span className="hidden rounded-full border border-primary/40 bg-primary/10 px-1.5 py-[1px] text-[8.5px] font-semibold uppercase tracking-[0.18em] text-primary/90 sm:inline">
                Beta
              </span>
            </div>
            <div className="mt-0.5 hidden truncate text-[10px] uppercase tracking-[0.22em] text-muted-foreground sm:block">
              analyze · optimize
            </div>
          </div>
        </a>

        {/* Desktop nav with sliding active pill */}
        <nav className="relative hidden items-center gap-1 text-sm md:flex">
          <div className="relative flex items-center gap-1 rounded-full border border-border/60 bg-background/40 px-1 py-1 backdrop-blur-md">
            {/* sliding active pill */}
            <span
              aria-hidden
              className="gpu pointer-events-none absolute top-1 bottom-1 rounded-full bg-gradient-to-b from-primary/15 to-primary/5 ring-1 ring-primary/25 shadow-[inset_0_0_0_1px_oklch(0.82_0.15_88/_0.08),0_6px_20px_-10px_oklch(0.82_0.15_88/_0.55)]"
              style={{
                left: pill.left,
                width: pill.width,
                opacity: pill.opacity,
                transition:
                  "left 380ms cubic-bezier(.22,1,.36,1), width 380ms cubic-bezier(.22,1,.36,1), opacity 200ms ease",
              }}
            />
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.id}
                href={`#${item.id}`}
                active={active === item.id}
                innerRef={(el) => {
                  linkRefs.current[item.id] = el;
                }}
              >
                {item.label}
              </NavLink>
            ))}
          </div>

          <a
            href="#workspace"
            className="btn-sheen relative ml-2 inline-flex items-center gap-1.5 overflow-hidden rounded-full bg-gradient-to-r from-[oklch(0.9_0.13_92)] via-[oklch(0.78_0.16_78)] to-[oklch(0.9_0.13_92)] px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-[0_10px_30px_-10px_var(--gold)] transition-transform duration-300 hover:-translate-y-0.5"
          >
            Try free <span aria-hidden>→</span>
          </a>
        </nav>

        {/* Mobile controls */}
        <div className="flex items-center gap-1.5 md:hidden">
          <a
            href="#workspace"
            className="btn-sheen relative inline-flex items-center gap-1 overflow-hidden rounded-full bg-gradient-to-r from-[oklch(0.9_0.13_92)] to-[oklch(0.78_0.16_78)] px-3 py-1.5 text-[11px] font-semibold text-primary-foreground shadow-[0_8px_24px_-8px_var(--gold)] transition-transform duration-300 hover:-translate-y-0.5"
          >
            Try <span aria-hidden>→</span>
          </a>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className={`grid h-9 w-9 place-items-center rounded-full border transition-all duration-300 ${
              menuOpen
                ? "border-primary/70 bg-primary/15 text-primary"
                : "border-border/70 bg-background/40 text-foreground/80 hover:border-primary/60 hover:text-primary"
            }`}
          >
            <svg
              className="h-4 w-4 transition-transform duration-300"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              style={{ transform: menuOpen ? "rotate(90deg)" : "rotate(0deg)" }}
            >
              <path d="M5 6h14" />
              <path
                d="M5 12h14"
                style={{
                  opacity: menuOpen ? 0 : 1,
                  transition: "opacity 200ms ease",
                }}
              />
              <path d="M5 18h14" />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu panel */}
      <div
        id="mobile-menu"
          ref={menuRef}
          className={`absolute inset-x-0 top-[calc(100%+8px)] z-20 origin-top overflow-hidden rounded-2xl border border-border/70 bg-background/90 backdrop-blur-xl shadow-[0_24px_60px_-20px_oklch(0.82_0.15_88/_0.55)] transition-all duration-300 md:hidden ${
            menuOpen ? "pointer-events-auto scale-100 opacity-100" : "pointer-events-none scale-[0.98] opacity-0"
          }`}
          style={{ willChange: "transform, opacity" }}
        >
          <div className="p-2">
            <div className="flex flex-col gap-0.5">
              {NAV_ITEMS.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm transition-colors ${
                    active === item.id
                      ? "bg-primary/10 text-primary"
                      : "text-foreground/80 hover:bg-background/60 hover:text-foreground"
                  }`}
                >
                  <span>{item.label}</span>
                  {active === item.id && (
                    <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_10px_var(--gold)]" />
                  )}
                </a>
              ))}
            </div>
            <div className="mt-2 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
            <a
              href="#workspace"
              onClick={() => setMenuOpen(false)}
              className="btn-sheen mt-2 flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-[oklch(0.9_0.13_92)] via-[oklch(0.78_0.16_78)] to-[oklch(0.9_0.13_92)] px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_10px_30px_-10px_var(--gold)]"
            >
              Try Thinkly free <span aria-hidden>→</span>
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}

function NavLink({
  href,
  active,
  children,
  innerRef,
}: {
  href: string;
  active?: boolean;
  children: ReactNode;
  innerRef?: (el: HTMLAnchorElement | null) => void;
}) {
  return (
    <a
      ref={innerRef}
      href={href}
      className={`relative z-[1] rounded-full px-3.5 py-1.5 transition-colors duration-200 ${
        active
          ? "text-primary"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </a>
  );
}

/* -------------------- Hero -------------------- */
function Hero() {
  return (
    <section id="top" className="relative mt-14 text-center md:mt-24">
      <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-background/30 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-primary/90 backdrop-blur">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-70" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_10px_var(--gold)]" />
        </span>
        Premium AI Problem Studio
      </div>

      <h1 className="mx-auto mt-6 max-w-4xl text-[2.6rem] font-semibold leading-[1.03] tracking-tight sm:text-6xl md:text-7xl">
        <span className="text-gradient-gold shimmer-text">Analyze</span>
        <span className="text-foreground/85"> &amp; </span>
        <span className="text-gradient-gold shimmer-text">Optimize</span>
        <br />
        <span className="text-foreground/85">any problem statement.</span>
      </h1>

      <p className="mx-auto mt-6 max-w-2xl text-[15px] leading-relaxed text-muted-foreground sm:text-lg">
        Thinkly turns messy thoughts into rigorous, professional problem statements —
        broken down top-to-bottom or rewritten spec-ready.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <a
          href="#workspace"
          className="btn-sheen relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-gradient-to-r from-[oklch(0.9_0.13_92)] via-[oklch(0.78_0.16_78)] to-[oklch(0.9_0.13_92)] px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[0_10px_40px_-10px_var(--gold)] transition"
        >
          Open the workspace <span aria-hidden>→</span>
        </a>
        <a
          href="#how"
          className="inline-flex items-center gap-2 rounded-full border border-border bg-background/40 px-6 py-3 text-sm text-foreground/90 backdrop-blur transition hover:border-primary/50 hover:text-primary"
        >
          See how it works
        </a>
      </div>

      {/* Trust strip */}
      <div className="mx-auto mt-10 grid max-w-lg grid-cols-3 gap-4 text-center text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
        <div>
          <div className="text-gradient-gold text-2xl font-semibold normal-case tracking-tight">
            10 sec
          </div>
          <div className="mt-1">to a full brief</div>
        </div>
        <div>
          <div className="text-gradient-gold text-2xl font-semibold normal-case tracking-tight">
            2 cores
          </div>
          <div className="mt-1">Analyze · Optimize</div>
        </div>
        <div>
          <div className="text-gradient-gold text-2xl font-semibold normal-case tracking-tight">
            0 fluff
          </div>
          <div className="mt-1">Professional tone</div>
        </div>
      </div>
    </section>
  );
}

/* -------------------- Mode Card -------------------- */
function ModeCard({
  mode,
  active,
  onClick,
  reveal,
}: {
  mode: (typeof MODES)[number];
  active: boolean;
  onClick: () => void;
  reveal: number;
}) {
  return (
    <button
      onClick={onClick}
      style={{ animationDelay: `${reveal * 80}ms` }}
      className={`reveal group relative overflow-hidden rounded-2xl p-6 text-left transition-all duration-300 ${
        active
          ? "glass gold-ring -translate-y-1"
          : "glass hover:-translate-y-0.5 hover:border-primary/40"
      }`}
    >
      {/* corner number */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-4 -top-6 select-none text-[7rem] font-black leading-none text-primary/[0.06] transition-all group-hover:text-primary/10"
      >
        {mode.num}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <span className="min-w-0 truncate text-[10px] uppercase tracking-[0.22em] text-primary/80">
          {mode.tag} · {mode.num}
        </span>
        <span
          className={`h-2 w-2 shrink-0 rounded-full transition ${
            active
              ? "bg-primary shadow-[0_0_18px_var(--gold)]"
              : "bg-muted-foreground/40"
          }`}
        />
      </div>

      <h3 className="mt-4 text-3xl text-gradient-gold">{mode.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {mode.desc}
      </p>

      <ul className="mt-4 space-y-1.5">
        {mode.bullets.map((b) => (
          <li
            key={b}
            className="flex items-start gap-2 text-[13px] text-foreground/80"
          >
            <span className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-primary/80" />
            <span>{b}</span>
          </li>
        ))}
      </ul>

      <div
        className={`mt-5 inline-flex items-center gap-1.5 text-xs font-medium transition ${
          active ? "text-primary" : "text-muted-foreground group-hover:text-primary"
        }`}
      >
        {active ? "Selected" : "Choose"} <span aria-hidden>→</span>
      </div>
    </button>
  );
}

/* -------------------- Empty state -------------------- */
function EmptyState({ mode }: { mode: Mode }) {
  return (
    <div className="glass rounded-3xl p-8 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-primary/30 to-accent/20 gold-ring">
        <span className="text-2xl">{mode === "analyze" ? "🔍" : "✨"}</span>
      </div>
      <h4 className="mt-4 text-lg font-semibold text-foreground/90">
        Your {mode === "analyze" ? "breakdown" : "optimized statement"} will appear here
      </h4>
      <p className="mt-1 text-sm text-muted-foreground">
        Drop a problem above, hit{" "}
        <span className="text-primary">
          {mode === "analyze" ? "Analyze" : "Optimize"}
        </span>
        , and Thinkly handles the rest.
      </p>
    </div>
  );
}

/* -------------------- Skeleton -------------------- */
function SkeletonAnswer() {
  return (
    <div className="glass rounded-3xl p-6 md:p-8">
      <div className="mb-4 flex items-center gap-2">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
        <div className="h-3 w-40 shimmer rounded-full" />
      </div>
      <div className="space-y-3">
        <div className="h-3 w-3/4 shimmer rounded-full" />
        <div className="h-3 w-5/6 shimmer rounded-full" />
        <div className="h-3 w-2/3 shimmer rounded-full" />
        <div className="h-3 w-11/12 shimmer rounded-full" />
        <div className="h-3 w-4/5 shimmer rounded-full" />
        <div className="h-3 w-3/5 shimmer rounded-full" />
      </div>
    </div>
  );
}

/* -------------------- How it works -------------------- */
function HowItWorks() {
  const steps = [
    {
      n: "01",
      t: "Drop your problem",
      d: "Paste a rough problem statement — messy is fine.",
    },
    {
      n: "02",
      t: "Pick a core",
      d: "Analyze for a full breakdown, Optimize to rewrite it.",
    },
    {
      n: "03",
      t: "Get a pro brief",
      d: "Structured Markdown, ready for docs, tickets, or execs.",
    },
  ];
  return (
    <section id="how" className="mt-24 scroll-mt-24">
      <SectionLabel eyebrow="Workflow" title="From messy to spec-ready in three steps." />
      <div className="relative mt-8 grid gap-4 md:grid-cols-3">
        {/* connector line */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-6 top-14 hidden h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent md:block"
        />
        {steps.map((s, i) => (
          <div
            key={s.n}
            style={{ animationDelay: `${i * 100}ms` }}
            className="reveal glass relative rounded-2xl p-6"
          >
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-primary/30 bg-background/40 text-sm font-semibold text-primary">
              {s.n}
            </div>
            <h4 className="mt-4 text-lg font-semibold text-foreground/95">{s.t}</h4>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {s.d}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* -------------------- Feature strip -------------------- */
function FeatureStrip() {
  const items = [
    {
      k: "Rigorous",
      v: "Sectioned, structured breakdowns with zero filler.",
      icon: "◆",
    },
    {
      k: "Professional",
      v: "Publication-ready tone, calibrated for docs & briefs.",
      icon: "✦",
    },
    {
      k: "Fast",
      v: "One prompt in, a full brief out. No back-and-forth.",
      icon: "➤",
    },
  ];
  return (
    <section id="features" className="mt-24 scroll-mt-24">
      <SectionLabel eyebrow="Why Thinkly" title="Built for people who ship briefs." />
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {items.map((i, idx) => (
          <div
            key={i.k}
            style={{ animationDelay: `${idx * 80}ms` }}
            className="reveal glass rounded-2xl p-6"
          >
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <span aria-hidden>{i.icon}</span>
            </div>
            <div className="mt-4 text-xs uppercase tracking-[0.22em] text-primary/80">
              {i.k}
            </div>
            <div className="mt-1 text-foreground/90">{i.v}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* -------------------- Section label -------------------- */
function SectionLabel({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="reveal">
      <div className="text-[11px] uppercase tracking-[0.28em] text-primary/80">
        {eyebrow}
      </div>
      <h2 className="mt-2 text-2xl font-semibold text-foreground/95 sm:text-3xl">
        {title}
      </h2>
    </div>
  );
}

/* -------------------- Logo (professional mark) -------------------- */
function Logo({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={className}
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="lg-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="oklch(0.95 0.11 92)" />
          <stop offset="55%" stopColor="oklch(0.82 0.15 88)" />
          <stop offset="100%" stopColor="oklch(0.62 0.14 78)" />
        </linearGradient>
        <linearGradient id="lg-em" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="oklch(0.28 0.07 165)" />
          <stop offset="100%" stopColor="oklch(0.45 0.13 155)" />
        </linearGradient>
        <radialGradient id="lg-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="oklch(0.82 0.15 88 / 0.55)" />
          <stop offset="100%" stopColor="oklch(0.82 0.15 88 / 0)" />
        </radialGradient>
      </defs>

      {/* soft glow */}
      <circle cx="20" cy="20" r="18" fill="url(#lg-glow)" />
      {/* base rounded square */}
      <rect
        x="3.5" y="3.5" width="33" height="33" rx="9"
        fill="url(#lg-em)"
        stroke="url(#lg-gold)"
        strokeWidth="1"
      />
      {/* thought-node graph: central node + orbit + three nodes */}
      <circle cx="20" cy="20" r="9.5" fill="none" stroke="url(#lg-gold)" strokeWidth="0.9" opacity="0.55" />
      <path d="M20 10.5 L27.5 24 L12.5 24 Z" fill="none" stroke="url(#lg-gold)" strokeWidth="1.1" strokeLinejoin="round" opacity="0.85" />
      <circle cx="20" cy="20" r="2.4" fill="url(#lg-gold)" />
      <circle cx="20" cy="10.5" r="1.9" fill="url(#lg-gold)" />
      <circle cx="27.5" cy="24" r="1.9" fill="url(#lg-gold)" />
      <circle cx="12.5" cy="24" r="1.9" fill="url(#lg-gold)" />
    </svg>
  );
}

/* -------------------- Footer -------------------- */
function Footer() {
  const year = new Date().getFullYear();
  const cols: { title: string; links: { label: string; href: string }[] }[] = [
    {
      title: "Product",
      links: [
        { label: "Analyze", href: "#workspace" },
        { label: "Optimize", href: "#workspace" },
        { label: "How it works", href: "#how" },
      ],
    },
    {
      title: "Explore",
      links: [
        { label: "Why Thinkly", href: "#features" },
        { label: "Try free", href: "#workspace" },
        { label: "Back to top", href: "#top" },
      ],
    },
  ];
  return (
    <footer
      id="footer"
      className="relative z-10 mt-16 border-t border-border/60 bg-background/40 backdrop-blur"
    >
      {/* gold hairline */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent"
      />
      {/* soft ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-24 h-24 bg-[radial-gradient(60%_100%_at_50%_100%,oklch(0.82_0.15_88/_0.18),transparent)]"
      />

      <div className="mx-auto max-w-6xl px-6 pb-8 pt-12">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          {/* brand */}
          <div>
            <a href="#top" className="inline-flex items-center gap-3">
              <Logo className="h-11 w-11 drop-shadow-[0_6px_20px_oklch(0.82_0.15_88/_0.35)]" />
              <div className="leading-tight">
                <div className="text-xl font-semibold text-gradient-gold">Thinkly</div>
                <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
                  analyze · optimize
                </div>
              </div>
            </a>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              A premium AI problem studio — turn messy thoughts into rigorous,
              spec-ready problem statements.
            </p>
          </div>

          {cols.map((c) => (
            <div key={c.title}>
              <div className="text-[11px] uppercase tracking-[0.28em] text-primary/85">
                {c.title}
              </div>
              <ul className="mt-4 space-y-2.5">
                {c.links.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      className="group inline-flex items-center gap-1.5 text-sm text-foreground/80 transition hover:text-primary"
                    >
                      <span className="h-px w-3 bg-primary/40 transition-all group-hover:w-5 group-hover:bg-primary" />
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* connect */}
          <div>
            <div className="text-[11px] uppercase tracking-[0.28em] text-primary/85">
              Connect
            </div>

            {/* Signature block */}
            <div className="mt-4 rounded-2xl border border-border/70 bg-background/40 p-4 backdrop-blur">
              <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
                Designed &amp; built by
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span
                  className="text-gradient-gold font-display text-2xl font-semibold tracking-tight"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  Sandeep
                </span>
                <span className="text-[10px] uppercase tracking-[0.24em] text-primary/70">
                  ·  Creator
                </span>
              </div>
              <div className="mt-3 flex items-center gap-2.5">
                <SocialLink href="https://github.com/sansar28v-cmyk" label="GitHub">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                    <path d="M12 .5A11.5 11.5 0 0 0 .5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.36-3.87-1.36-.53-1.34-1.3-1.7-1.3-1.7-1.06-.72.08-.71.08-.71 1.17.08 1.79 1.2 1.79 1.2 1.04 1.78 2.73 1.27 3.4.97.1-.76.4-1.27.74-1.56-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.28 1.2-3.09-.12-.3-.52-1.48.11-3.08 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.64 1.6.24 2.78.12 3.08.75.81 1.2 1.83 1.2 3.09 0 4.43-2.7 5.4-5.26 5.69.41.35.78 1.05.78 2.12v3.14c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5z" />
                  </svg>
                </SocialLink>
                <SocialLink href="https://www.linkedin.com/in/sandeep-v-5b7351375" label="LinkedIn">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                    <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5.001 2.5 2.5 0 0 1 0-5zM3 9h4v12H3zM10 9h3.83v1.71h.05c.53-.95 1.82-1.95 3.75-1.95 4.01 0 4.75 2.64 4.75 6.08V21h-4v-5.34c0-1.27-.02-2.9-1.77-2.9-1.78 0-2.05 1.39-2.05 2.82V21h-4z" />
                  </svg>
                </SocialLink>
                <SocialLink href="https://www.instagram.com/peace._.ig?igsh=bTM5dHRqbXBkY3Fi" label="Instagram">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="5" />
                    <circle cx="12" cy="12" r="4" />
                    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                  </svg>
                </SocialLink>
              </div>
            </div>

            <a
              href="#top"
              className="mt-5 inline-flex items-center gap-2 rounded-full border border-border bg-background/40 px-3.5 py-1.5 text-xs text-foreground/80 backdrop-blur transition hover:border-primary/60 hover:text-primary"
            >
              <span aria-hidden>↑</span> Back to top
            </a>
          </div>
        </div>

        {/* divider */}
        <div className="mt-10 h-px w-full bg-gradient-to-r from-transparent via-border to-transparent" />

        <div className="mt-6 flex flex-col items-center justify-center gap-3 text-xs text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2 tracking-wide">
            <span className="text-foreground/80">© {year}</span>
            <span className="font-semibold text-gradient-gold">Thinkly</span>
            <span className="text-muted-foreground/60">·</span>
            <span>All rights reserved.</span>
          </div>
        </div>

      </div>
    </footer>
  );
}

function SocialLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      className="grid h-10 w-10 place-items-center rounded-full border border-border bg-background/40 text-foreground/80 transition hover:-translate-y-0.5 hover:border-primary/60 hover:text-primary hover:shadow-[0_0_24px_-4px_var(--gold)]"
    >
      {children}
    </a>
  );
}

/* -------------------- Spinner -------------------- */
function Spinner() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 animate-spin text-primary-foreground"
      fill="none"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="3"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* -------------------- Grain overlay -------------------- */
function Grain() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[5] opacity-[0.05] mix-blend-overlay"
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
      }}
    />
  );
}

/* -------------------- Spotlight cursor -------------------- */
function SpotlightCursor() {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = ref.current;
    if (!el) return;
    el.style.opacity = "1";
    let x = 0;
    let y = 0;
    let ticking = false;
    const apply = () => {
      ticking = false;
      el.style.transform = `translate3d(${x - 250}px, ${y - 250}px, 0)`;
    };
    const onMove = (e: MouseEvent) => {
      x = e.clientX;
      y = e.clientY;
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(apply);
      }
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);
  return (
    <div
      ref={ref}
      aria-hidden
      className="gpu pointer-events-none fixed left-0 top-0 z-[6] h-[500px] w-[500px] rounded-full opacity-0 mix-blend-screen transition-opacity duration-500"
      style={{
        background:
          "radial-gradient(circle, oklch(0.82 0.15 88 / 0.18) 0%, transparent 60%)",
      }}
    />
  );
}


/* -------------------- 3D-ish parallax scene (mobile-safe, buttery smooth) -------------------- */
function Scene3D() {
  return (
    <div
      aria-hidden
      className="gpu pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      {/* horizon fade */}
      <div
        className="absolute inset-x-0 bottom-[-20%] h-[70%] opacity-40"
        style={{
          background:
            "linear-gradient(to top, oklch(0.14 0.04 165) 0%, transparent 70%)",
        }}
      />
      {/* perspective grid floor */}
      <div
        className="gpu absolute inset-x-0 bottom-0 h-[55%] opacity-25 [transform:perspective(900px)_rotateX(60deg)_translateZ(0)]"
        style={{
          backgroundImage:
            "linear-gradient(oklch(0.82 0.15 88 / 0.35) 1px, transparent 1px), linear-gradient(90deg, oklch(0.82 0.15 88 / 0.35) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
          transformOrigin: "bottom",
          maskImage: "linear-gradient(to top, black 40%, transparent 100%)",
        }}
      />

      {/* Ambient orbs — smaller & lighter blur on mobile to keep scroll smooth */}
      <div className="gpu absolute -left-24 top-24 h-56 w-56 rounded-full bg-[radial-gradient(circle_at_30%_30%,oklch(0.82_0.15_88_/_0.5),transparent_60%)] blur-xl animate-float-slow md:h-72 md:w-72 md:blur-2xl" />
      <div className="gpu absolute right-[-4rem] top-[30%] h-72 w-72 rounded-full bg-[radial-gradient(circle_at_60%_40%,oklch(0.55_0.14_155_/_0.5),transparent_60%)] blur-2xl animate-float-slower md:right-[-6rem] md:h-96 md:w-96 md:blur-3xl" />
      <div className="gpu absolute left-[35%] top-[62%] h-56 w-56 rounded-full bg-[radial-gradient(circle_at_50%_50%,oklch(0.35_0.12_160_/_0.55),transparent_60%)] blur-2xl animate-float-slow md:h-80 md:w-80 md:blur-3xl" />

      {/* 3D wireframe orb — now visible on mobile, scaled + fewer rings for perf */}
      <div className="absolute right-[-2rem] top-[8%] [perspective:1000px] md:right-[6%] md:top-[6%]">
        <div className="gpu relative h-36 w-36 [transform-style:preserve-3d] animate-orb md:h-56 md:w-56">
          {/* mobile: 5 vertical + 4 horizontal; desktop: 8 + 6 */}
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className={`absolute inset-0 rounded-full border ${
                i >= 5 ? "hidden md:block" : ""
              }`}
              style={{
                borderColor: "oklch(0.82 0.15 88 / 0.35)",
                transform: `rotateY(${(180 / 8) * i}deg) translateZ(0)`,
              }}
            />
          ))}
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={`h${i}`}
              className={`absolute inset-0 rounded-full border ${
                i >= 4 ? "hidden md:block" : ""
              }`}
              style={{
                borderColor: "oklch(0.55 0.14 155 / 0.35)",
                transform: `rotateX(${(180 / 6) * i}deg) translateZ(0)`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
