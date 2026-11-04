"use client";
// ─── گوی هوشمند حساب‌یار (v2.14) — دستیار Gemini ───
// گوی سبز سه‌بعدی شناور و قابل‌جابه‌جایی؛ با لمس باز می‌شود و حالت گفتگو دارد:
// تایپ یا صدا (گفتن دستور) — مثلاً «مبالغ بین ۱۰۰ تا ۵۰۰ هزار تومان رو ببر تو هزینه‌های جاری»
// مدل Gemini فقط اقدام برمی‌گرداند؛ اجرا روی دادهٔ محلی خود دستگاه انجام می‌شود.

import { useCallback, useEffect, useRef, useState } from "react";
import { pushBackHandler } from "@/lib/back-nav";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, X, Mic, MicOff, Send, Volume2, VolumeX, Eraser, Settings2, Loader2 } from "lucide-react";
import { api, type AppSettings, type Stats, type Category, type BankAccount, type Installment, type AutoCatRule } from "@/lib/client-api";
import { callGemini, buildSystemPrompt, buildDataContext, parseAiResponse } from "@/lib/ai/gemini";
import { validateAiActions, executeAiAction } from "@/lib/ai/actions";
import { formatMoneyPlain, toDisplayAmount } from "@/lib/format";
import { daysUntilDue } from "@/lib/notifications";

interface ChatMsg {
  role: "user" | "model";
  text: string;
}

const ORB_POS_KEY = "aiOrbPos";

// ─── صدا: تشخیص گفتار (ورود صوتی) ───

async function isNativePlatform(): Promise<boolean> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

type StopFn = () => void;

/** شروع گوش‌دادن — خروجی نهایی به onFinal می‌رسد. stopFn برای قطع. */
async function startListening(onPartial: (t: string) => void, onFinal: (t: string) => void, onError: (m: string) => void): Promise<StopFn | null> {
  const native = await isNativePlatform();
  if (native) {
    try {
      const { SpeechRecognition } = await import("@capacitor-community/speech-recognition");
      const perm = await SpeechRecognition.checkPermissions();
      if (perm.speechRecognition !== "granted") {
        const req = await SpeechRecognition.requestPermissions();
        if (req.speechRecognition !== "granted") {
          onError("دسترسی میکروفون داده نشد — از تنظیمات گوشی فعال کنید.");
          return null;
        }
      }
      let stopped = false;
      const removePartial = await SpeechRecognition.addListener("partialResults", (data) => {
        const m: string[] = (data as { matches?: string[] }).matches || [];
        if (m.length > 0) onPartial(m[0]);
      });
      SpeechRecognition.start({
        language: "fa-IR",
        maxResults: 1,
        partialResults: true,
        popup: false,
      }).catch(() => onError("تشخیص گفتار شروع نشد — دوباره امتحان کنید."));
      return () => {
        if (stopped) return;
        stopped = true;
        removePartial.remove();
        void SpeechRecognition.stop();
        void SpeechRecognition.removeAllListeners();
      };
    } catch {
      onError("تشخیص گفتار روی این گوشی در دسترس نیست.");
      return null;
    }
  }
  // مرورگر: Web Speech API
  const W = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
  const SR = (W.SpeechRecognition || W.webkitSpeechRecognition) as
    | (new () => {
        lang: string;
        interimResults: boolean;
        maxAlternatives: number;
        onresult: ((e: { resultIndex: number; results: { isFinal: boolean; 0: { transcript: string } }[] }) => void) | null;
        onerror: ((e: { error?: string }) => void) | null;
        onend: (() => void) | null;
        start: () => void;
        stop: () => void;
      })
    | undefined;
  if (!SR) {
    onError("گوشی/مرورگر شما تشخیص گفتار ندارد — دستور را تایپ کنید.");
    return null;
  }
  try {
    const rec = new SR();
    rec.lang = "fa-IR";
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) onFinal(r[0].transcript.trim());
        else onPartial(r[0].transcript);
      }
    };
    rec.onerror = (e) => onError(e.error === "not-allowed" ? "دسترسی میکروفون داده نشد." : "خطا در تشخیص گفتار.");
    rec.start();
    return () => rec.stop();
  } catch {
    onError("تشخیص گفتار شروع نشد.");
    return null;
  }
}

// ─── صدا: خواندن پاسخ (TTS) ───

async function speak(text: string): Promise<void> {
  const clean = text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/gu, "").trim();
  if (!clean) return;
  const native = await isNativePlatform();
  if (native) {
    try {
      const { TextToSpeech } = await import("@capacitor-community/text-to-speech");
      await TextToSpeech.speak({ text: clean, lang: "fa-IR", rate: 1.0, pitch: 1.0, volume: 1.0 });
      return;
    } catch {
      // ادامه به fallback
    }
  }
  try {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(clean);
      u.lang = "fa-IR";
      window.speechSynthesis.speak(u);
    }
  } catch {
    // بی‌صدا رد شود
  }
}

async function stopSpeaking(): Promise<void> {
  try {
    if (await isNativePlatform()) {
      const { TextToSpeech } = await import("@capacitor-community/text-to-speech");
      await TextToSpeech.stop();
    } else if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  } catch {
    // ignore
  }
}

// ─── گوی اصلی ───

export function AiOrb({ onOpenSettings }: { onOpenSettings: () => void }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<ChatMsg[]>([
    {
      role: "model",
      text: "سلام! 👋 من دستیار هوشمند حساب‌یارم.\nدستور بده تا انجام بدهم — مثلاً:\n«مبالغ بین ۱۰۰ تا ۵۰۰ هزار تومان رو ببر تو هزینه‌های جاری»\nیا بپرس: «این ماه چقد خرج کردم؟»",
    },
  ]);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakOn, setSpeakOn] = useState(false);
  const stopListenRef = useRef<StopFn | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const dragState = useRef<{ startX: number; startY: number; moved: boolean; left: number; top: number } | null>(null);

  const { data: settings } = useQuery<AppSettings>({
    queryKey: ["app-settings"],
    queryFn: () => api.get("/api/settings"),
  });
  const { data: stats } = useQuery<Stats>({
    queryKey: ["stats"],
    queryFn: () => api.get("/api/stats"),
  });
  const { data: categories } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: () => api.get("/api/categories"),
  });
  const { data: accounts } = useQuery<BankAccount[]>({
    queryKey: ["bank-accounts"],
    queryFn: () => api.get("/api/bank-accounts"),
  });
  const { data: installments } = useQuery<Installment[]>({
    queryKey: ["installments"],
    queryFn: () => api.get("/api/installments"),
  });
  const { data: rules } = useQuery<AutoCatRule[]>({
    queryKey: ["auto-cat-rules"],
    queryFn: () => api.get("/api/auto-cat-rules"),
  });

  // اعلان کوچک روی گوی: اقساط/چک‌های نزدیک — خودش خبر می‌دهد
  const soonCount = (installments || []).filter((i) => {
    if (i.paid) return false;
    const d = daysUntilDue(new Date(i.dueDate).getTime(), Date.now());
    return d >= 0 && d <= (settings?.notif.daysBefore ?? 2);
  }).length;

  // موقعیت ذخیره‌شدهٔ گوی
  useEffect(() => {
    try {
      const raw = localStorage.getItem(ORB_POS_KEY);
      if (raw) {
        const p = JSON.parse(raw) as { left: number; top: number };
        if (typeof p.left === "number" && typeof p.top === "number") setPos(p);
      }
    } catch {
      // ignore
    }
  }, []);

  // تنظیم خواندن پاسخ
  useEffect(() => {
    if (settings?.ai) setSpeakOn(Boolean(settings.ai.speakReplies));
  }, [settings?.ai]);

  // پنل باز گوی با دکمهٔ برگشت گوشی بسته می‌شود — قبل از تعویض تب
  useEffect(() => {
    if (!open) return;
    return pushBackHandler(() => {
      setOpen(false);
      return true;
    });
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, busy]);

  // ─── درگ گوی (جابه‌جایی با انگشت) ───
  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    dragState.current = { startX: e.clientX, startY: e.clientY, moved: false, left: rect.left, top: rect.top };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const ds = dragState.current;
    if (!ds) return;
    const dx = e.clientX - ds.startX;
    const dy = e.clientY - ds.startY;
    if (!ds.moved && Math.hypot(dx, dy) < 7) return;
    ds.moved = true;
    const w = 56;
    const left = Math.min(Math.max(4, ds.left + dx), window.innerWidth - w - 4);
    const top = Math.min(Math.max(4, ds.top + dy), window.innerHeight - w - 84); // زیر نوار پایین نرود
    setPos({ left, top });
  };
  const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const ds = dragState.current;
    dragState.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    if (!ds) return;
    if (!ds.moved) {
      setOpen((v) => !v);
      return;
    }
    const w = 56;
    const left = Math.min(Math.max(4, ds.left + (e.clientX - ds.startX)), window.innerWidth - w - 4);
    const top = Math.min(Math.max(4, ds.top + (e.clientY - ds.startY)), window.innerHeight - w - 84);
    setPos({ left, top });
    try {
      localStorage.setItem(ORB_POS_KEY, JSON.stringify({ left, top }));
    } catch {
      // ignore
    }
  };

  // ─── ارسال پیام به Gemini ───
  const send = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();
      if (!text || busy) return;
      const apiKey = settings?.geminiApiKey || "";
      if (!apiKey) {
        setMsgs((m) => [
          ...m,
          { role: "user", text },
          { role: "model", text: "برای فعال‌سازی دستیار هوشمند، کلید Gemini را در تنظیمات وارد کنید. 🔑" },
        ]);
        return;
      }
      setBusy(true);
      setInput("");
      setMsgs((m) => [...m, { role: "user", text }, { role: "model", text: "…" }]);

      try {
        // زمینهٔ تازهٔ داده‌ها در هر نوبت
        const [st, cats, accs, insts, rls] = await Promise.all([
          api.get<Stats>("/api/stats").catch(() => null),
          api.get<Category[]>("/api/categories").catch(() => []),
          api.get<BankAccount[]>("/api/bank-accounts").catch(() => []),
          api.get<Installment[]>("/api/installments").catch(() => []),
          api.get<AutoCatRule[]>("/api/auto-cat-rules").catch(() => []),
        ]);
        const accBalance = new Map<string, number>();
        for (const s of st?.accountSummaries || []) accBalance.set(s.id, s.balance);
        const systemPrompt =
          buildSystemPrompt(new Date().toISOString()) +
          "\n\n" +
          buildDataContext({
            accounts: accs.map((a) => ({ id: a.id, name: a.name, bankName: a.bankName, balance: accBalance.get(a.id) ?? a.smsBalance ?? a.initialBalance ?? 0 })),
            categories: cats.map((c) => ({ id: c.id, name: c.name, type: c.type })),
            stats: {
              totalBalance: st?.totalBalance ?? 0,
              monthIncome: st?.monthIncome ?? 0,
              monthExpense: st?.monthExpense ?? 0,
            },
            installments: insts
              .filter((i) => !i.paid)
              .slice(0, 10)
              .map((i) => ({ id: i.id, title: i.title, kind: i.kind, amount: i.amount, dueDate: i.dueDate, paid: false })),
            rules: (rls || []).map((r) => ({ id: r.id, flow: r.flow, match: r.match, exact: r.exact, min: r.min, max: r.max, categoryId: r.categoryId })),
          });

        // تاریخچهٔ گفتگو (۱۲ نوبت آخر)
        const history: { role: "user" | "model"; text: string }[] = [...msgs]
          .filter((m) => m.text !== "…")
          .slice(-12)
          .concat([{ role: "user", text }]);

        const res = await callGemini({ apiKey, systemPrompt, history });
        if (!res.ok) {
          setMsgs((m) => [...m.slice(0, -1), { role: "model", text: `⚠️ ${res.text}` }]);
          setBusy(false);
          return;
        }
        const parsed = parseAiResponse(res.text);
        const { actions, errors } = validateAiActions(parsed.actions);
        const catNames = new Map<string, string>((categories || []).map((c) => [c.id, c.name] as const));

        const lines: string[] = [];
        if (parsed.reply) lines.push(parsed.reply);
        for (const err of errors) lines.push(`⚠️ ${err}`);
        if (actions.length > 0) {
          const results: string[] = [];
          for (const action of actions) {
            try {
              const r = await executeAiAction(action, api, { categoryNames: catNames });
              results.push(r.message);
              if (r.refresh.length > 0) {
                for (const k of r.refresh) qc.invalidateQueries({ queryKey: [k] });
              }
            } catch (e) {
              results.push(`⚠️ اجرای اقدام ناموفق بود: ${e instanceof Error ? e.message : "خطای نامشخص"}`);
            }
          }
          lines.push(...results);
        }
        if (lines.length === 0) lines.push("چیزی برای گفتن پیدا نکردم — دوباره بپرس.");
        const finalText = lines.join("\n");
        setMsgs((m) => [...m.slice(0, -1), { role: "model", text: finalText }]);
        if (speakOn) void speak(finalText);
      } catch (e) {
        setMsgs((m) => [...m.slice(0, -1), { role: "model", text: `⚠️ ${e instanceof Error ? e.message : "خطای نامشخص"}` }]);
      } finally {
        setBusy(false);
      }
    },
    [busy, settings?.geminiApiKey, categories, msgs, qc, speakOn]
  );

  // ─── میکروفون ───
  const toggleMic = useCallback(async () => {
    if (listening) {
      stopListenRef.current?.();
      stopListenRef.current = null;
      setListening(false);
      return;
    }
    setListening(true);
    const stop = await startListening(
      (partial) => setInput(partial),
      (final) => {
        if (final) void send(final);
      },
      (err) => {
        setMsgs((m) => [...m, { role: "model", text: `🎙 ${err}` }]);
      }
    );
    stopListenRef.current = stop;
    if (!stop) setListening(false);
  }, [listening, send]);

  const toggleSpeak = async () => {
    const next = !speakOn;
    setSpeakOn(next);
    if (!next) await stopSpeaking();
    try {
      await api.put("/api/settings", { ai: { speakReplies: next } });
      qc.invalidateQueries({ queryKey: ["app-settings"] });
    } catch {
      // ignore
    }
  };

  const orbStyle = pos ? { left: pos.left, top: pos.top } : undefined;
  const orbCls = pos ? "" : "right-4 bottom-24 lg:bottom-8 lg:left-8";

  const hasKey = Boolean(settings?.geminiApiKey);

  // دستیار از تنظیمات خاموش شده؟ (v2.14.2) — گوی و پنل نشان داده نمی‌شود
  if (settings?.ai && settings.ai.aiEnabled === false) return null;

  return (
    <>
      {/* گوی شناور */}
      <button
        type="button"
        aria-label="دستیار هوشمند"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className={`fixed z-40 flex h-14 w-14 touch-none select-none items-center justify-center rounded-full outline-none ${orbCls}`}
        style={{
          ...orbStyle,
          background: "radial-gradient(circle at 30% 25%, #a7f3d0 0%, #34d399 32%, #059669 62%, #064e3b 100%)",
          boxShadow: "0 8px 20px rgba(5,150,105,0.45), inset 0 -5px 10px rgba(0,0,0,0.28), inset 0 4px 8px rgba(255,255,255,0.4)",
        }}
      >
        {/* حلقهٔ درخشش — حالت گفتگو/گوش‌دادن */}
        <span
          className={`pointer-events-none absolute inset-0 rounded-full border-2 border-emerald-300/70 ${
            listening ? "animate-ping" : open ? "animate-pulse" : "hidden"
          }`}
        />
        <Sparkles className="relative h-6 w-6 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]" />
        {/* نشان اقساط نزدیک — خودش خبر می‌دهد */}
        {soonCount > 0 && !open && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow">
            {soonCount.toLocaleString("fa-IR", { useGrouping: false })}
          </span>
        )}
      </button>

      {/* پنجرهٔ گفتگو */}
      {open && (
        <div
          dir="rtl"
          className="fixed z-50 flex flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl"
          style={
            pos
              ? { left: Math.min(pos.left, Math.max(12, window.innerWidth - 392)), top: Math.min(pos.top - 12, window.innerHeight - 200), transform: "translateY(-100%)", width: "min(92vw, 380px)", maxHeight: "70vh" }
              : { left: 12, right: 12, bottom: "calc(env(safe-area-inset-bottom) + 150px)", maxHeight: "68vh" }
          }
        >
          {/* هدر */}
          <div className="flex items-center justify-between border-b bg-emerald-700 px-3 py-2 text-white">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              <span className="text-sm font-bold">دستیار هوشمند</span>
              {listening && <span className="flex items-center gap-1 text-[10px] text-emerald-200"><Mic className="h-3 w-3 animate-pulse" /> دارم گوش می‌دهم…</span>}
            </div>
            <div className="flex items-center gap-0.5">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-emerald-600" onClick={toggleSpeak} aria-label="خواندن پاسخ با صدا">
                {speakOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white hover:bg-emerald-600"
                onClick={() => setMsgs((m) => m.slice(0, 1))}
                aria-label="پاک کردن گفتگو"
              >
                <Eraser className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-emerald-600" onClick={() => setOpen(false)} aria-label="بستن">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* پیام‌ها */}
          <div ref={scrollRef} className="flex-1 space-y-2.5 overflow-y-auto p-3">
            {!hasKey && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs leading-5 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                کلید Gemini تنظیم نشده است.
                <Button size="sm" variant="outline" className="mr-2 h-7 text-xs" onClick={() => { setOpen(false); onOpenSettings(); }}>
                  <Settings2 className="ml-1 h-3.5 w-3.5" /> رفتن به تنظیمات
                </Button>
              </div>
            )}
            {msgs.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-xs leading-6 ${
                  m.role === "user"
                    ? "self-end bg-emerald-600 text-white"
                    : "self-start bg-muted text-foreground"
                }`}
              >
                {m.text}
              </div>
            ))}
            {busy && (
              <div className="flex items-center gap-1.5 self-start text-[11px] text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> در حال فکر کردن…
              </div>
            )}
          </div>

          {/* پیشنهادهای سریع — فقط اول گفتگو */}
          {msgs.length <= 1 && !busy && (
            <div className="flex flex-wrap gap-1.5 px-3 pb-2">
              {["این ماه چقدر خرج کردم؟", "موجودی کل چنده؟", "خلاصهٔ وضعیت بدهی‌ها"].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void send(s)}
                  className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* ورودی */}
          <div className="flex items-center gap-1.5 border-t p-2">
            <Button
              variant="outline"
              size="icon"
              className={`h-9 w-9 shrink-0 ${listening ? "border-red-400 text-red-600" : ""}`}
              onClick={() => void toggleMic()}
              aria-label={listening ? "قطع میکروفون" : "گفتن دستور با صدا"}
              disabled={busy}
            >
              {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              placeholder={listening ? "دارم گوش می‌دهم…" : "دستور بنویس یا بگو…"}
              className="h-9 flex-1 text-sm"
              disabled={busy}
            />
            <Button
              size="icon"
              className="h-9 w-9 shrink-0 bg-emerald-700 hover:bg-emerald-800"
              onClick={() => void send(input)}
              disabled={busy || !input.trim()}
              aria-label="ارسال"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

export function formatMoneyForAi(rial: number): string {
  return formatMoneyPlain(toDisplayAmount(rial));
}
