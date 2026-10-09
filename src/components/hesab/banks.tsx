"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import {
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Landmark,
  Wallet,
  MessageSquareText,
  MessagesSquare,
  Stethoscope,
  Inbox,
  Download,
  CheckCheck,
  XCircle,
  Sparkles,
  BadgeCheck,
  BellRing,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { api, type BankAccount, type SmsLog, type Transaction } from "@/lib/client-api";
import {
  formatMoney,
  formatMoneyU,
  parseMoneyInput,
  formatMoneyPlain,
  currencyLabel,
  toDisplayAmount,
  toStoredAmount,
} from "@/lib/format";
import {
  HesabSms,
  isNativeAndroid,
  getSmsPermission,
  requestSmsPermission,
  readInboxSince,
  type SmsPermState,
  type NativeSms,
} from "@/lib/native-sms";
import { syncBankSms, getLastSmsSync, judgeSms, type SmsSyncResult, type SmsSyncVerdict } from "@/lib/sms-sync";
import { parseConfiguredSenders, senderMatches, normalizeSender } from "@/lib/sms-match";
import { parseBankSms } from "@/lib/sms-parser";
import { getMeta, setMeta } from "@/lib/local-db";
import type { PluginListenerHandle } from "@capacitor/core";

const BANKS = [
  "ملت", "صادرات", "ملی", "تجارت", "پارسیان", "پاسارگاد", "سامان", "کشاورزی",
  "مسکن", "سپه", "صنعت و معدن", "اقتصاد نوین", "کارآفرین", "سینا", "دی", "پست بانک",
  "شهر", "آینده", "انصار", "قوامین", "رسالت", "رفاه", "توسعه صادرات", "سایر",
];

const COLORS = ["#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#84cc16", "#f97316"];

function AccountDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing?: BankAccount | null;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState(editing?.name || "");
  const [bankName, setBankName] = useState(editing?.bankName || "");
  const [cardNumber, setCardNumber] = useState(editing?.cardNumber || "");
  const [accountNumber, setAccountNumber] = useState(editing?.accountNumber || "");
  const [iban, setIban] = useState(editing?.iban || "");
  const [senders, setSenders] = useState<string[]>(
    editing?.smsSender ? editing.smsSender.split(/[,،]/).map((s) => s.trim()).filter(Boolean) : []
  );
  const [senderInput, setSenderInput] = useState("");
  const [initialBalance, setInitialBalance] = useState(
    editing ? formatMoneyPlain(toDisplayAmount(editing.initialBalance)) : ""
  );
  const [color, setColor] = useState(editing?.color || COLORS[0]);

  const addSender = () => {
    const v = senderInput.trim();
    if (!v) return;
    if (!senders.some((s) => s.toLowerCase() === v.toLowerCase())) setSenders([...senders, v]);
    setSenderInput("");
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const body = {
        name,
        bankName,
        cardNumber: cardNumber || null,
        accountNumber: accountNumber || null,
        iban: iban || null,
        smsSender: senders.join(",") || null,
        initialBalance: toStoredAmount(parseMoneyInput(initialBalance)),
        color,
      };
      if (editing) return api.put(`/api/bank-accounts/${editing.id}`, body);
      return api.post("/api/bank-accounts", body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bank-accounts"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      toast({ title: editing ? "حساب ویرایش شد" : "حساب بانکی اضافه شد" });
      onOpenChange(false);
    },
    onError: (e: Error) => toast({ title: "خطا", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>{editing ? "ویرایش حساب" : "افزودن حساب بانکی"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>نام بانک</Label>
              <Select value={bankName} onValueChange={setBankName}>
                <SelectTrigger>
                  <SelectValue placeholder="انتخاب بانک" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {BANKS.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>نام نمایشی حساب</Label>
              <Input placeholder="مثلاً: ملت - جاری" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>شماره کارت (اختیاری)</Label>
              <Input dir="ltr" className="text-left" placeholder="6104-..." value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>شماره حساب (اختیاری)</Label>
              <Input dir="ltr" className="text-left" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>شماره شبا (اختیاری)</Label>
            <Input dir="ltr" className="text-left" placeholder="IR..." value={iban} onChange={(e) => setIban(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>شماره(های) فرستنده پیامک بانک (برای خواندن خودکار)</Label>
            <div className="flex gap-2">
              <Input
                dir="ltr"
                className="text-left"
                placeholder="مثلاً 9999 یا 5000142 — بعد Enter بزنید"
                value={senderInput}
                onChange={(e) => setSenderInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSender();
                  }
                }}
              />
              <Button type="button" variant="outline" className="shrink-0" onClick={addSender} disabled={!senderInput.trim()}>
                <Plus className="h-4 w-4" /> افزودن
              </Button>
            </div>
            {senders.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {senders.map((s) => (
                  <span
                    key={s}
                    dir="ltr"
                    className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                  >
                    {s}
                    <button
                      type="button"
                      onClick={() => setSenders(senders.filter((x) => x !== s))}
                      className="text-emerald-600 hover:text-red-600 dark:text-emerald-400"
                      aria-label={`حذف ${s}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground leading-5">
              فقط پیامک‌های همین شماره‌ها خوانده می‌شود — هر چند شماره که بانک استفاده می‌کند اضافه کنید (شماره فرستنده را از خود پیامک ببینید).
              اگر چند حساب در یک بانک دارید، شماره حساب/کارت هر حساب را دقیق وارد کنید تا پیامک‌ها تفکیک شوند.
            </p>
          </div>
          <div className="grid gap-2">
            <Label>موجودی اولیه ({currencyLabel()})</Label>
            <Input
              inputMode="numeric"
              dir="ltr"
              className="text-left font-bold tabular-nums-persian"
              value={initialBalance ? formatMoneyPlain(parseMoneyInput(initialBalance)) : ""}
              onChange={(e) => setInitialBalance(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>رنگ</Label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-7 w-7 rounded-full transition ${color === c ? "ring-2 ring-offset-2 ring-foreground" : ""}`}
                  style={{ backgroundColor: c }}
                  aria-label={`رنگ ${c}`}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            انصراف
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !name.trim() || !bankName}
            className="bg-emerald-700 hover:bg-emerald-800"
          >
            {mutation.isPending ? "..." : editing ? "ذخیره" : "افزودن حساب"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const toFa = (n: number) => {
  try {
    return n.toLocaleString("fa-IR");
  } catch {
    return String(n);
  }
};

// ─── کشف شماره‌های فرستنده واقعی روی گوشی ───
// کاربر معمولاً شماره فرستنده پیامک بانکش را نمی‌داند؛ این دیالوگ صندوق ورودی را می‌خواند،
// پیامک‌ها را بر اساس فرستنده گروه می‌کند و با یک لمس می‌توان شماره را به حساب وصل کرد.
interface SenderGroup {
  raw: string; // نمونه اصلی فرستنده (پرتکرارترین شکل)
  norm: string; // شکل نرمال‌شده برای گروه‌بندی
  count: number;
  latestBody: string;
  latestDate: number;
  messages: NativeSms[]; // ۱۰ پیامک آخر (جدیدترین اول) — برای بررسی تک‌تک در دیالوگ
}

function groupInboxBySender(messages: NativeSms[]): SenderGroup[] {
  const map = new Map<string, SenderGroup>();
  for (const m of messages) {
    const raw = String(m.sender || "").trim();
    if (!raw) continue;
    const norm = normalizeSender(raw);
    if (!norm) continue;
    const cur = map.get(norm);
    if (cur) {
      cur.count++;
      if (m.date > cur.latestDate) {
        cur.latestDate = m.date;
        cur.latestBody = m.body || "";
        if (raw.length >= cur.raw.length) cur.raw = raw;
      }
    } else {
      map.set(norm, { raw, norm, count: 1, latestBody: m.body || "", latestDate: m.date, messages: [] });
    }
  }
  // ۱۰ پیامک آخر هر فرستنده (جدیدترین اول) برای نمایش حکم تک‌تک
  for (const g of map.values()) {
    g.messages = messages
      .filter((m) => normalizeSender(String(m.sender || "").trim()) === g.norm)
      .sort((a, b) => b.date - a.date)
      .slice(0, 10);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

function SenderPickerDialog({
  open,
  onOpenChange,
  accounts,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  accounts: BankAccount[];
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [groups, setGroups] = useState<SenderGroup[]>([]);
  const [attachFor, setAttachFor] = useState<string | null>(null); // norm شماره‌ای که انتخاب حساب برایش باز است
  const [pickedAccount, setPickedAccount] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null); // norm گروهی که پیامک‌هایش تک‌تک بررسی می‌شود

  const configured = accounts.flatMap((a) => parseConfiguredSenders(a.smsSender));

  const loadInbox = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const msgs = await readInboxSince(since, 500);
      setGroups(groupInboxBySender(msgs));
    } catch (e) {
      setLoadError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && isNativeAndroid()) void loadInbox();
    if (!open) {
      setAttachFor(null);
      setPickedAccount("");
    }
  }, [open, loadInbox]);

  const attachMutation = useMutation({
    mutationFn: async ({ accountId, sender }: { accountId: string; sender: string }) => {
      const acc = accounts.find((a) => a.id === accountId);
      if (!acc) throw new Error("حساب پیدا نشد");
      const list = parseConfiguredSenders(acc.smsSender);
      if (!list.some((s) => normalizeSender(s) === normalizeSender(sender))) list.push(sender);
      return api.put(`/api/bank-accounts/${accountId}`, { smsSender: list.join(",") });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bank-accounts"] });
      toast({ title: "شماره فرستنده به حساب اضافه شد — حالا پیامک‌های همان شماره خوانده می‌شود" });
      setAttachFor(null);
      setPickedAccount("");
    },
    onError: (e: Error) => toast({ title: "خطا", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessagesSquare className="h-5 w-5 text-emerald-700" />
            شماره‌های فرستنده پیامک روی گوشی
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs leading-5 text-muted-foreground">
          این فهرست، فرستنده‌های واقعی پیامک‌های ۳۰ روز اخیر گوشی شماست. اگر شماره‌ای که بانک‌تان با آن پیامک می‌دهد در این لیست نیست و «تنظیم شده» هم نیست، روی «افزودن به حساب» بزنید تا پیامک‌های همان شماره خوانده شود.
        </p>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> در حال خواندن صندوق پیامک...
          </div>
        ) : loadError ? (
          <div className="space-y-2 py-4 text-center">
            <p className="text-sm text-red-600">خطا در خواندن پیامک‌ها</p>
            <p className="text-xs text-muted-foreground">دسترسی پیامک باید فعال باشد</p>
            <Button size="sm" variant="outline" onClick={() => void loadInbox()}>تلاش دوباره</Button>
          </div>
        ) : groups.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">پیامکی در ۳۰ روز اخیر پیدا نشد</p>
        ) : (
          <div className="max-h-[50vh] space-y-1.5 overflow-y-auto">
            {groups.slice(0, 50).map((g) => {
              const isConfigured = senderMatches(g.raw, configured);
              const isPersonal = /^(\+?98|0)?9\d{9}$/.test(g.raw.replace(/\s/g, "")) && g.raw.replace(/\D/g, "").length === 11;
              return (
                <div key={g.norm} className="rounded-xl border p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span dir="ltr" className="shrink-0 font-bold">{g.raw}</span>
                      <Badge variant="secondary" className="shrink-0">{toFa(g.count)} پیامک</Badge>
                      {isPersonal && <span className="shrink-0 text-[10px] text-muted-foreground">(شخصی)</span>}
                    </div>
                    {isConfigured ? (
                      <Badge className="shrink-0 bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900/50 dark:text-emerald-300">
                        <CheckCheck className="ml-1 h-3 w-3" /> تنظیم شده
                      </Badge>
                    ) : attachFor === g.norm ? (
                      <div className="flex shrink-0 items-center gap-1">
                        <Select value={pickedAccount} onValueChange={setPickedAccount}>
                          <SelectTrigger className="h-8 w-[130px] text-xs">
                            <SelectValue placeholder="انتخاب حساب" />
                          </SelectTrigger>
                          <SelectContent>
                            {accounts.map((a) => (
                              <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          className="h-8 bg-emerald-700 px-2 text-xs hover:bg-emerald-800"
                          disabled={!pickedAccount || attachMutation.isPending}
                          onClick={() => attachMutation.mutate({ accountId: pickedAccount, sender: g.raw })}
                        >
                          ثبت
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => { setAttachFor(null); setPickedAccount(""); }}>
                          انصراف
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" className="h-8 shrink-0 text-xs" onClick={() => setAttachFor(g.norm)}>
                        <Plus className="ml-1 h-3 w-3" /> افزودن به حساب
                      </Button>
                    )}
                  </div>
                  {g.latestBody && (
                    <p className="mt-1.5 line-clamp-1 text-[11px] leading-4 text-muted-foreground" dir="rtl">
                      {g.latestBody}
                    </p>
                  )}
                  {/* بررسی تک‌تک پیامک‌های همین فرستنده — کاربر می‌بیند هر پیامک چه حکمی می‌گیرد */}
                  <div className="mt-1.5">
                    <button
                      type="button"
                      className="text-[11px] font-medium text-emerald-700 hover:underline dark:text-emerald-400"
                      onClick={() => setExpanded(expanded === g.norm ? null : g.norm)}
                    >
                      {expanded === g.norm ? "بستن بررسی پیامک‌ها ▲" : "چرا ثبت نمی‌شود؟ بررسی تک‌تک پیامک‌ها ▼"}
                    </button>
                    {expanded === g.norm && (
                      <div className="mt-2 space-y-1.5 border-t pt-2">
                        {g.messages.map((m) => {
                          const j = judgeSms({ sender: g.raw, text: (m.body || "").trim(), accounts, autoImport: true });
                          const vmj = VERDICT_META[j.verdict];
                          const p = (m.body || "").trim() ? parseBankSms(m.body.trim()) : null;
                          return (
                            <div key={m.id} className="rounded-lg border bg-muted/30 p-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className="shrink-0 text-[10px] text-muted-foreground">{new Date(m.date).toLocaleString("fa-IR")}</span>
                                <span className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${vmj.cls}`}>{vmj.label}</span>
                              </div>
                              <p className="mt-1 line-clamp-2 text-[11px] leading-4" dir="rtl">{m.body}</p>
                              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                                {p?.amount ? (
                                  <span>
                                    مبلغ: <span className="font-bold tabular-nums-persian">{formatMoneyU(p.unit === "toman" ? p.amount * 10 : p.amount)}</span>
                                    {p.unit === "toman" ? " (تومان×۱۰)" : ""}
                                  </span>
                                ) : (
                                  <span>مبلغ: تشخیص نشد</span>
                                )}
                                {p?.balance != null && <span>مانده: <span className="font-bold tabular-nums-persian">{formatMoneyU(p.balance)}</span></span>}
                                {p?.type !== "unknown" && p && <span>{p.type === "income" ? "واریز ↑" : "برداشت ↓"}</span>}
                                {j.accountId && <span>حساب: {accounts.find((a) => a.id === j.accountId)?.name || "?"}</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>بستن</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── عیب‌یابی پیامک: شماره فرستنده + متن پیامک → نتیجه کامل تشخیص ───
const VERDICT_META: Record<SmsSyncVerdict, { label: string; cls: string }> = {
  auto_import: { label: "خودکار ثبت می‌شود ✓", cls: "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-700" },
  queued_no_amount: { label: "در صف بررسی می‌آید", cls: "bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-700" },
  queued_unsure: { label: "در صف بررسی می‌آید", cls: "bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-700" },
  rejected_sender: { label: "رد می‌شود — شماره فرستنده ناهمسان", cls: "bg-red-50 text-red-800 border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-700" },
  rejected_junk: { label: "رد می‌شود — تبلیغاتی/رمز", cls: "bg-red-50 text-red-800 border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-700" },
  rejected_foreign: { label: "رد می‌شود — حساب دیگری است", cls: "bg-red-50 text-red-800 border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-700" },
};

function SmsDiagnostic({ accounts }: { accounts: BankAccount[] }) {
  const [sender, setSender] = useState("");
  const [text, setText] = useState("");
  const [result, setResult] = useState<null | {
    verdict: SmsSyncVerdict;
    accountId: string | null;
    explanation: string;
    parsed: { type: string; amount: number | null; bankName: string | null; accountRef: string | null };
    senderOk: boolean | null;
  }>(null);

  const analyze = () => {
    const t = text.trim();
    if (!t) return;
    const j = judgeSms({ sender: sender.trim(), text: t, accounts, autoImport: true });
    const senderOk = j.verdict === "rejected_sender"
      ? false
      : senderMatches(sender.trim(), accounts.flatMap((a) => parseConfiguredSenders(a.smsSender)));
    const p = j.verdict === "rejected_sender" || j.verdict === "rejected_junk" ? null : parseBankSms(t);
    setResult({
      verdict: j.verdict,
      accountId: j.accountId,
      explanation: j.explanation,
      parsed: {
        type: p?.type || "نامشخص",
        amount: p?.amount ?? null,
        bankName: p?.bankName || null,
        accountRef: p?.accountRefDigits || p?.cardTail || null,
      },
      senderOk,
    });
  };

  const vm = result ? VERDICT_META[result.verdict] : null;
  const accName = result?.accountId ? accounts.find((a) => a.id === result.accountId)?.name : null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Stethoscope className="h-4 w-4 text-emerald-700" />
          عیب‌یابی پیامک — چرا شناسایی نشد؟
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs leading-5 text-muted-foreground">
          شماره فرستنده و متن دقیق پیامک را اینجا بچسبانید تا ببینید برنامه با آن چه می‌کند و اگر شناسایی نمی‌شود، دقیقاً کجا رد می‌شود.
        </p>
        <div className="grid gap-2">
          <Input
            dir="ltr"
            className="text-left"
            placeholder="شماره فرستنده (مثلاً +9850004271 یا 9999)"
            value={sender}
            onChange={(e) => setSender(e.target.value)}
          />
          <textarea
            dir="rtl"
            rows={3}
            className="w-full rounded-xl border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-[rgba(5,150,105,0.4)]"
            placeholder="متن کامل پیامک بانک را همین‌جا بچسبانید..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <Button onClick={analyze} disabled={!text.trim()} className="bg-emerald-700 hover:bg-emerald-800">
            <Stethoscope className="ml-1 h-4 w-4" /> بررسی کن
          </Button>
        </div>
        {result && vm && (
          <div className="space-y-2">
            <div className={`rounded-xl border p-3 text-sm font-medium ${vm.cls}`}>
              {vm.label}
              <div className="mt-1 text-xs font-normal leading-5">{result.explanation}</div>
            </div>
            <div className="grid grid-cols-2 gap-2 rounded-xl border bg-muted/50 p-3 text-xs sm:grid-cols-4">
              <div>
                <div className="text-muted-foreground">شماره فرستنده</div>
                <div className={result.senderOk === false ? "font-bold text-red-600" : "font-bold text-emerald-700"}>
                  {result.senderOk === false ? "ناهمسان ✗" : result.senderOk ? "تأیید ✓" : "—"}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">نوع</div>
                <div className="font-bold">{result.parsed.type === "income" ? "واریز ↑" : result.parsed.type === "expense" ? "برداشت ↓" : "نامشخص"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">مبلغ</div>
                <div className="font-bold tabular-nums-persian">{result.parsed.amount ? formatMoneyU(result.parsed.amount) : "تشخیص نشد"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">بانک / شناسه</div>
                <div className="font-bold">{result.parsed.bankName || "—"}{result.parsed.accountRef ? ` • ${result.parsed.accountRef}` : ""}</div>
              </div>
              {accName && (
                <div className="col-span-2 sm:col-span-4">
                  <div className="text-muted-foreground">حساب تطبیق‌شده</div>
                  <div className="font-bold text-emerald-700">{accName}</div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── خواندن خودکار پیامک‌های بانکی (فقط اندروید) ───
function SmsAutoSync({ accounts }: { accounts: BankAccount[] }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [perm, setPerm] = useState<SmsPermState | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(0);
  const [autoImport, setAutoImport] = useState(true);
  const [lastResult, setLastResult] = useState<SmsSyncResult | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const syncingRef = useRef(false);
  const optsRef = useRef({ autoImport: true });
  useEffect(() => {
    optsRef.current = { autoImport };
  }, [autoImport]);

  const runSync = useCallback(
    async (silent: boolean) => {
      if (syncingRef.current) return;
      syncingRef.current = true;
      setSyncing(true);
      try {
        const res = await syncBankSms({ ...optsRef.current });
        setLastResult(res);
        setLastSync(await getLastSmsSync());
        qc.invalidateQueries({ queryKey: ["sms-logs"] });
        qc.invalidateQueries({ queryKey: ["transactions"] });
        qc.invalidateQueries({ queryKey: ["stats"] });
        if (res.ok) {
          const parts: string[] = [];
          if (res.imported > 0) parts.push(`${toFa(res.imported)} تراکنش خودکار ثبت شد`);
          if (res.balanceUpdated > 0) parts.push(`موجودی ${toFa(res.balanceUpdated)} حساب از پیامک بانک به‌روز شد`);
          if (res.queued > 0) parts.push(`${toFa(res.queued)} پیامک در صف بررسی است`);
          if (res.skippedForeign > 0) parts.push(`${toFa(res.skippedForeign)} پیامک متعلق به حساب دیگری بود و نادیده گرفته شد`);
          if (res.skippedSender > 0) parts.push(`${toFa(res.skippedSender)} پیامک از شماره‌های ناهمسان نادیده شد`);
          const desc = parts.length > 0 ? parts.join(" — ") : "پیامک بانکی جدیدی نبود";
          if (!silent || res.imported > 0 || res.queued > 0) {
            toast({ title: "پیامک‌ها بررسی شد", description: desc });
          }
        } else if (!silent && res.reason === "no_senders") {
          toast({
            title: "شماره فرستنده پیامک تنظیم نشده است",
            description: "در ویرایش هر حساب بانکی، شماره فرستنده پیامک آن بانک را وارد کنید تا فقط پیامک‌های همان شماره خوانده شود",
            variant: "destructive",
          });
        } else if (!silent && res.reason === "permission") {
          toast({ title: "دسترسی پیامک داده نشده است", variant: "destructive" });
        } else if (!silent && res.reason === "error") {
          toast({ title: "خطا در خواندن پیامک‌ها", variant: "destructive" });
        }
      } catch {
        if (!silent) toast({ title: "خطا در همگام‌سازی", variant: "destructive" });
      } finally {
        syncingRef.current = false;
        setSyncing(false);
      }
    },
    [qc, toast]
  );

  // بارگذاری اولیه + sync خودکار در باز شدن تب
  useEffect(() => {
    if (!isNativeAndroid()) return;
    setMounted(true);
    void (async () => {
      const [p, ls, ai] = await Promise.all([
        getSmsPermission(),
        getLastSmsSync(),
        getMeta<boolean>("smsAutoImport"),
      ]);
      setPerm(p);
      setLastSync(ls || 0);
      if (ai === false) setAutoImport(false);
      if (p === "granted") void runSync(true);
    })();
  }, [runSync]);

  // گوش دادن به پیامک زنده (وقتی برنامه باز است)
  useEffect(() => {
    if (!isNativeAndroid()) return;
    let handle: PluginListenerHandle | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    HesabSms.addListener("smsReceived", () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void runSync(true), 3000);
    })
      .then((h) => {
        handle = h;
      })
      .catch(() => {});
    return () => {
      if (timer) clearTimeout(timer);
      void handle?.remove();
    };
  }, [runSync]);

  const askPermission = async () => {
    const p = await requestSmsPermission();
    setPerm(p);
    if (p === "granted") {
      toast({ title: "دسترسی پیامک فعال شد" });
      void runSync(false);
    } else if (p === "denied") {
      toast({
        title: "دسترسی رد شد",
        description: "از تنظیمات گوشی ← برنامه‌ها ← حساب‌یار ← مجوزها، دسترسی پیامک را فعال کنید",
        variant: "destructive",
      });
    }
  };

  if (!mounted || perm === null) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <BellRing className="h-4 w-4 text-emerald-700" />
          خواندن خودکار پیامک بانکی
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {perm !== "granted" ? (
          <div className="flex items-start gap-3 rounded-xl border bg-amber-50 p-3 dark:bg-amber-950/30">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="space-y-2">
              <p className="text-xs leading-5">
                برای ثبت خودکار واریز و برداشت، برنامه باید پیامک‌های بانکی را بخواند.
                هیچ داده‌ای از گوشی شما خارج نمی‌شود و همه‌چیز روی خود دستگاه ذخیره می‌شود.
              </p>
              <Button size="sm" onClick={askPermission} className="bg-emerald-700 hover:bg-emerald-800">
                <ShieldCheck className="ml-1 h-4 w-4" /> اجازه دسترسی به پیامک‌ها
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>دسترسی فعال — {lastSync > 0 ? `آخرین بررسی: ${new Date(lastSync).toLocaleString("fa-IR")}` : "هنوز بررسی نشده"}</span>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setPickerOpen(true)}>
                  <MessagesSquare className="ml-1 h-3 w-3" />
                  شماره‌های روی گوشی
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" disabled={syncing} onClick={() => void runSync(false)}>
                  <RefreshCw className={`ml-1 h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
                  {syncing ? "در حال بررسی..." : "بررسی الان"}
                </Button>
              </div>
            </div>
            {/* شفاف‌سازی: اگر پیامک‌هایی از شماره‌های ناهمسان رد شد، کاربر باید بداند */}
            {lastResult?.ok && lastResult.bankCount === 0 && lastResult.skippedSender > 0 && (
              <div className="flex items-start justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-500/40 dark:bg-amber-950/40">
                <p className="text-xs leading-5 text-amber-900 dark:text-amber-200">
                  {toFa(lastResult.skippedSender)} پیامک روی گوشی بود ولی شماره فرستنده‌اش با شماره‌های تنظیم‌شده نمی‌خواند —
                  احتمالاً شماره فرستنده بانک چیز دیگری است.
                </p>
                <Button size="sm" variant="outline" className="h-7 shrink-0 text-xs" onClick={() => setPickerOpen(true)}>
                  دیدن شماره‌ها
                </Button>
              </div>
            )}
            {/* گزارش همگام‌سازی — همیشه نمایان، تا کاربر ببیند بررسی واقعاً انجام شده یا نه */}
            {lastResult && !lastResult.ok && (
              <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-xs leading-5 text-red-900 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-200">
                <div className="font-bold">بررسی پیامک‌ها انجام نشد</div>
                <div className="mt-0.5">
                  {lastResult.reason === "no_senders"
                    ? "هنوز هیچ شماره فرستنده‌ای به حساب‌ها وصل نشده — دکمه «شماره‌های روی گوشی» را بزنید و شماره بانک را به حساب اضافه کنید."
                    : lastResult.reason === "permission"
                      ? "دسترسی پیامک فعال نیست — دسترسی را از گوشی اجازه دهید."
                      : lastResult.reason === "not_native"
                        ? "این قابلیت فقط در اپ اندروید (APK) کار می‌کند."
                        : "خطا در خواندن صندوق پیامک — دوباره تلاش کنید."}
                </div>
              </div>
            )}
            {lastResult?.ok && (
              <div className="grid grid-cols-3 gap-2 rounded-xl border bg-muted/40 p-3 text-center text-xs sm:grid-cols-4">
                <div>
                  <div className="text-muted-foreground">خوانده‌شده</div>
                  <div className="font-bold tabular-nums-persian">{toFa(lastResult.total)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">پیامک بانکی</div>
                  <div className="font-bold tabular-nums-persian">{toFa(lastResult.bankCount)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">ثبت خودکار</div>
                  <div className="font-bold tabular-nums-persian text-emerald-700 dark:text-emerald-400">{toFa(lastResult.imported)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">در صف بررسی</div>
                  <div className="font-bold tabular-nums-persian text-amber-600">{toFa(lastResult.queued)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">موجودی به‌روز شد</div>
                  <div className="font-bold tabular-nums-persian text-emerald-700 dark:text-emerald-400">{toFa(lastResult.balanceUpdated)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">شماره ناهمسان</div>
                  <div className="font-bold tabular-nums-persian">{toFa(lastResult.skippedSender)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">حساب غریبه</div>
                  <div className="font-bold tabular-nums-persian">{toFa(lastResult.skippedForeign)}</div>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between rounded-xl border p-3">
              <div className="pl-3">
                <div className="text-sm font-medium">ثبت خودکار تراکنش‌ها</div>
                <p className="text-[11px] leading-4 text-muted-foreground">
                  پیامک‌های واریز/برداشت با مبلغ واضح، بدون دست وارد شوند؛ موارد نامطمئن در صف بررسی می‌مانند
                </p>
              </div>
              <Switch
                checked={autoImport}
                onCheckedChange={(v) => {
                  setAutoImport(v);
                  void setMeta("smsAutoImport", v);
                }}
              />
            </div>
          </>
        )}
      </CardContent>
      {perm === "granted" && <SenderPickerDialog open={pickerOpen} onOpenChange={setPickerOpen} accounts={accounts} />}
    </Card>
  );
}

function SmsSection({ accounts }: { accounts: BankAccount[] }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<{ type: string; amount: number | null; bankName: string | null; confidence: number } | null>(null);
  const [importLog, setImportLog] = useState<SmsLog | null>(null);
  const [importType, setImportType] = useState<"income" | "expense">("expense");
  const [importAmount, setImportAmount] = useState("");
  const [importPurpose, setImportPurpose] = useState("");
  const [importAccount, setImportAccount] = useState("");

  const { data: logs, isLoading } = useQuery<SmsLog[]>({
    queryKey: ["sms-logs"],
    queryFn: () => api.get("/api/sms"),
  });

  const parseMutation = useMutation({
    mutationFn: (t: string) => api.post<{ type: string; amount: number | null; bankName: string | null; confidence: number }>("/api/sms/parse", { text: t }),
    onSuccess: (p) => {
      setPreview(p);
      if (p.confidence < 0.55) {
        toast({ title: "تشخیص نامطمئن", description: "پیامک ذخیره شد ولی نوع یا مبلغ مشخص نشد. می‌توانید دستی وارد کنید.", variant: "destructive" });
      }
    },
    onError: (e: Error) => toast({ title: "خطا", description: e.message, variant: "destructive" }),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ log: SmsLog }>("/api/sms", { text });
      return res.log;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sms-logs"] });
      toast({ title: "پیامک به صف وارد شد" });
      setText("");
      setPreview(null);
    },
    onError: (e: Error) => toast({ title: "خطا", description: e.message, variant: "destructive" }),
  });

  const actionMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => api.put(`/api/sms/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sms-logs"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      toast({ title: "انجام شد" });
      setImportLog(null);
      setImportPurpose("");
    },
    onError: (e: Error) => toast({ title: "خطا", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.del(`/api/sms/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sms-logs"] }),
  });

  const pending = (logs || []).filter((l) => l.status === "pending");
  const processed = (logs || []).filter((l) => l.status !== "pending");

  return (
    <div className="space-y-4">
      {/* خواندن خودکار پیامک (فقط در اپ اندروید نمایش داده می‌شود) */}
      <SmsAutoSync accounts={accounts} />

      {/* عیب‌یابی پیامک — چرا شناسایی نشد؟ */}
      <SmsDiagnostic accounts={accounts} />

      {/* ورود پیامک */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquareText className="h-4 w-4 text-emerald-700" />
            ورود پیامک بانکی
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs leading-5 text-muted-foreground">
            پیامک واریز یا برداشت بانک را کپی و اینجا بچسبانید. نرم‌افزار به‌طور خودکار نوع (واریز/برداشت)، مبلغ و نام بانک را تشخیص می‌دهد.
            در نسخه اندروید، پیامک‌ها به‌صورت خودکار خوانده و وارد می‌شوند.
          </p>
          <textarea
            dir="rtl"
            rows={3}
            className="w-full rounded-xl border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-[rgba(5,150,105,0.4)]"
            placeholder="مثال: بانک ملت: برداشت مبلغ 500,000 ریال از حساب 1234 بابت خرید"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          {preview && (
            <div className="rounded-xl border bg-muted/50 p-3 text-sm">
              <div className="mb-1 flex items-center gap-1.5 font-medium text-emerald-800">
                <Sparkles className="h-4 w-4" /> نتیجه تشخیص خودکار
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-xs text-muted-foreground">نوع</div>
                  <div className="font-bold">{preview.type === "income" ? "واریز ↑" : preview.type === "expense" ? "برداشت ↓" : "نامشخص"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">مبلغ</div>
                  <div className="font-bold tabular-nums-persian">{preview.amount ? formatMoneyU(preview.amount) : "نامشخص"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">بانک</div>
                  <div className="font-bold">{preview.bankName || "نامشخص"}</div>
                </div>
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => parseMutation.mutate(text)}
              disabled={!text.trim() || parseMutation.isPending}
              className="flex-1"
            >
              پیش‌نمایش تشخیص
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!text.trim() || saveMutation.isPending} className="flex-1 bg-emerald-700 hover:bg-emerald-800">
              <Inbox className="ml-1 h-4 w-4" /> افزودن به صف
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* صف پیامک‌ها */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            صف پیامک‌ها {pending.length > 0 && <Badge className="mr-1 bg-emerald-700">{pending.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <Skeleton className="h-20 rounded-xl" />
          ) : pending.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">پیامک جدیدی در صف نیست</p>
          ) : (
            pending.map((log) => (
              <div key={log.id} className="rounded-xl border p-3">
                <p className="text-xs leading-5 text-muted-foreground" dir="rtl">
                  {log.rawText}
                </p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant={log.parsedType === "income" ? "default" : "destructive"} className={log.parsedType === "income" ? "bg-emerald-700" : ""}>
                      {log.parsedType === "income" ? "واریز" : log.parsedType === "expense" ? "برداشت" : "نامشخص"}
                    </Badge>
                    <span className="font-bold tabular-nums-persian">{log.parsedAmount ? formatMoneyU(log.parsedAmount) : "؟"}</span>
                    {log.bankName && <span className="text-muted-foreground">• بانک {log.bankName}</span>}
                    {log.sender && <span dir="ltr" className="text-muted-foreground">• از {log.sender}</span>}
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" className="h-7 bg-emerald-700 text-xs hover:bg-emerald-800" onClick={() => { setImportType(log.parsedType === "income" ? "income" : "expense"); setImportAmount(log.parsedAmount ? formatMoneyPlain(toDisplayAmount(log.parsedAmount)) : ""); setImportLog(log); }}>
                      <Download className="ml-1 h-3 w-3" /> ثبت تراکنش
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => actionMutation.mutate({ id: log.id, body: { action: "ignore" } })}
                    >
                      <XCircle className="ml-1 h-3 w-3" /> نادیده
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteMutation.mutate(log.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* تاریخچه پردازش‌شده */}
      {processed.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">پردازش‌شده‌ها</CardTitle>
          </CardHeader>
          <CardContent className="max-h-48 space-y-1.5 overflow-y-auto">
            {processed.map((log) => (
              <div key={log.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs">
                <span className="line-clamp-1 max-w-[60%] text-muted-foreground">{log.rawText}</span>
                <div className="flex items-center gap-2">
                  {log.status === "imported" ? (
                    <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900/50 dark:text-emerald-300">
                      <CheckCheck className="ml-1 h-3 w-3" /> ثبت شد
                    </Badge>
                  ) : (
                    <Badge variant="secondary">نادیده</Badge>
                  )}
                  <button onClick={() => deleteMutation.mutate(log.id)} className="text-red-400 hover:text-red-600">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* دیالوگ ثبت تراکنش از پیامک */}
      <Dialog open={!!importLog} onOpenChange={(v) => !v && setImportLog(null)}>
        <DialogContent className="sm:max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle>ثبت تراکنش از پیامک</DialogTitle>
          </DialogHeader>
          {importLog && (
            <div className="grid gap-4 py-1">
              <p className="rounded-lg bg-muted p-2 text-xs leading-5 text-muted-foreground">{importLog.rawText}</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>نوع تراکنش</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setImportType("income")}
                      className={`rounded-xl border-2 p-2 text-sm font-medium transition ${
                        importType === "income"
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      واریز ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => setImportType("expense")}
                      className={`rounded-xl border-2 p-2 text-sm font-medium transition ${
                        importType === "expense"
                          ? "border-red-500 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      برداشت ↓
                    </button>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>مبلغ {currencyLabel()} (قابل اصلاح)</Label>
                  <SmsAmountInput
                    initial={importLog.parsedAmount ?? null}
                    value={importAmount}
                    onChange={setImportAmount}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>بابت (اختیاری)</Label>
                <Input placeholder="مثلاً: خرید از فروشگاه" value={importPurpose} onChange={(e) => setImportPurpose(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>حساب بانکی</Label>
                <Select value={importAccount} onValueChange={setImportAccount}>
                  <SelectTrigger>
                    <SelectValue placeholder="انتخاب حساب" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">بدون حساب</SelectItem>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name} {importLog.bankName && a.bankName.includes(importLog.bankName) ? "✓" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportLog(null)}>
              انصراف
            </Button>
            <Button
              className="bg-emerald-700 hover:bg-emerald-800"
              disabled={actionMutation.isPending || parseMoneyInput(importAmount) <= 0}
              onClick={() =>
                importLog &&
                actionMutation.mutate({
                  id: importLog.id,
                  body: {
                    action: "import",
                    type: importType,
                    amount: toStoredAmount(parseMoneyInput(importAmount)),
                    purpose: importPurpose || null,
                    bankAccountId: importAccount || null,
                  },
                })
              }
            >
              {actionMutation.isPending ? "..." : "ثبت"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SmsAmountInput({ initial, value, onChange }: { initial: number | null; value: string; onChange: (v: string) => void }) {
  return (
    <Input
      inputMode="numeric"
      dir="ltr"
      className="text-left font-bold tabular-nums-persian"
      value={value ? formatMoneyPlain(parseMoneyInput(value)) : ""}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function Banks({ onOpenTxDialog }: { onOpenTxDialog?: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<BankAccount | null>(null);

  const { data: accounts, isLoading } = useQuery<BankAccount[]>({
    queryKey: ["bank-accounts"],
    queryFn: () => api.get("/api/bank-accounts"),
  });

  const { data: transactions } = useQuery<Transaction[]>({
    queryKey: ["transactions", "all"],
    queryFn: () => api.get("/api/transactions?limit=500"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.del(`/api/bank-accounts/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bank-accounts"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      toast({ title: "حساب حذف شد" });
    },
    onError: (e: Error) => toast({ title: "خطا", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button onClick={() => { setEditing(null); setAddOpen(true); }} className="bg-emerald-700 hover:bg-emerald-800">
          <Plus className="ml-1 h-4 w-4" /> حساب جدید
        </Button>
        {onOpenTxDialog && (
          <Button variant="outline" onClick={onOpenTxDialog}>
            <Wallet className="ml-1 h-4 w-4" /> ثبت تراکنش دستی
          </Button>
        )}
      </div>

      {/* کارت حساب‌ها */}
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
      ) : !accounts || accounts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Landmark className="h-10 w-10 text-muted-foreground/40" />
            <p className="font-medium">حساب بانکی ثبت نشده</p>
            <p className="text-sm text-muted-foreground">می‌توانید چند حساب بانکی اضافه کنید و پیامک‌های هر کدام را مدیریت کنید</p>
            <Button onClick={() => setAddOpen(true)} className="mt-2 bg-emerald-700 hover:bg-emerald-800">
              <Plus className="ml-1 h-4 w-4" /> افزودن اولین حساب
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {accounts.some((a) => !a.smsSender) && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-200">
              برای خواندن خودکار پیامک، شماره فرستنده پیامک بانک را در ویرایش حساب وارد کنید (مثل 9999).
              بدون آن هیچ پیامکی خوانده نمی‌شود. اگر چند حساب در یک بانک دارید، شماره حساب/کارت هرکدام را هم وارد کنید تا پیامک‌ها تفکیک شوند.
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((acc) => {
            const accTxs = (transactions || []).filter((t) => t.bankAccountId === acc.id);
            const inc = accTxs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
            const exp = accTxs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
            const balance = acc.initialBalance + inc - exp;
            const maskedCard = acc.cardNumber ? `•••• ${acc.cardNumber.slice(-4)}` : null;
            return (
              <Card key={acc.id} className="relative overflow-hidden py-0">
                <div className="absolute inset-x-0 top-0 h-1.5" style={{ backgroundColor: acc.color }} />
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold">{acc.name}</div>
                      <div className="text-xs text-muted-foreground">بانک {acc.bankName}</div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setEditing(acc); setAddOpen(true); }}>
                          <Pencil className="ml-2 h-4 w-4" /> ویرایش
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => {
                            if (confirm(`حذف حساب ${acc.name}؟ تراکنش‌هایش حذف نمی‌شوند.`)) deleteMutation.mutate(acc.id);
                          }}
                        >
                          <Trash2 className="ml-2 h-4 w-4" /> حذف
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  {maskedCard && <div dir="ltr" className="mt-2 text-sm tracking-widest text-muted-foreground">{maskedCard}</div>}
                  {acc.smsSender && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
                      <MessageSquareText className="h-3.5 w-3.5" />
                      <span dir="ltr">{acc.smsSender}</span>
                      <span className="text-muted-foreground">— پیامک این شماره خوانده می‌شود</span>
                    </div>
                  )}
                  <div className="mt-3 text-2xl font-bold tabular-nums-persian">
                    {formatMoneyU(acc.smsBalance != null ? acc.smsBalance : balance)}
                    <span className="mr-1 text-xs font-normal text-muted-foreground">{currencyLabel()}</span>
                  </div>
                  {acc.smsBalance != null ? (
                    <div className="mt-1 space-y-0.5">
                      <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                        <BadgeCheck className="h-3.5 w-3.5" />
                        <span>
                          موجودی بانک — از پیامک {acc.smsBalanceDate ? new Date(acc.smsBalanceDate).toLocaleDateString("fa-IR") : ""}
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        محاسبه‌شده از تراکنش‌ها: <span className="tabular-nums-persian">{formatMoneyU(balance)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1 text-[11px] text-muted-foreground">محاسبه‌شده از تراکنش‌ها — با پیامک «مانده» بانک دقیق می‌شود</div>
                  )}
                  <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                    <div className="flex justify-between">
                      <span>موجودی اولیه</span>
                      <span className="tabular-nums-persian">{formatMoneyU(acc.initialBalance)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                      <span>جمع واریز</span>
                      <span className="tabular-nums-persian">+{formatMoneyU(inc)}</span>
                    </div>
                    <div className="flex justify-between text-red-600 dark:text-red-400">
                      <span>جمع برداشت</span>
                      <span className="tabular-nums-persian">−{formatMoneyU(exp)}</span>
                    </div>
                    <Progress value={Math.min(100, (exp / Math.max(1, inc)) * 100)} className="mt-1 h-1" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
          </div>
        </>
      )}

      <SmsSection accounts={accounts || []} />

      {addOpen && <AccountDialog open={addOpen} onOpenChange={setAddOpen} editing={editing} />}
    </div>
  );
}
