#!/usr/bin/env python3
# جراحی banks.tsx برای v2.16:
# ۱) حذف SenderPickerDialog + groupInboxBySender (وابسته به مجوز پیامک — حذف شد برای امنیت گوگل‌پلی)
# ۲) جایگزینی SmsAutoSync با SmsGuideCard (کارت راهنمای share/چسباندن — بدون هیچ مجوزی)
# ۳) SmsSection: دریافت پیامِ Share‌شده (رویداد بومی + consume) + تاریخ پیام هنگام ثبت
import re, sys

p = "src/components/hesab/banks.tsx"
src = open(p, encoding="utf-8").read()
lines = src.split("\n")

def find(pred, start=0):
    for i in range(start, len(lines)):
        if pred(lines[i]):
            return i
    return -1

# ─── برش SenderPicker (خط 297 تا قبل از 531) ───
a = find(lambda l: l.startswith("// ─── کشف شماره‌های فرستنده واقعی روی گوشی"))
b = find(lambda l: l.startswith("// ─── عیب‌یابی پیامک"))
assert a > 0 and b > a, f"sender bounds {a},{b}"
del lines[a:b]

# ─── برش SmsAutoSync (تا قبل از function SmsSection) ───
a = find(lambda l: l.startswith("// ─── خواندن خودکار پیامک‌های بانکی"))
b = find(lambda l: l.startswith("function SmsSection"))
assert a > 0 and b > a, f"sync bounds {a},{b}"
guide = '''// ─── راهنمای ثبت پیام بانک (v2.16) ───
// خواندن مستقیم پیامک (مجوز READ_SMS/RECEIVE_SMS) حذف شد تا گوگل‌پلی و Play Protect
// برنامه را «خطرناک» علامت نزنند. مسیر جایگزین بدون هیچ مجوزی: Share کردن پیام/نوتیفیکیشن
// بانک (مثلاً بلوبانک) به حساب‌یار، یا کپی و چسباندن در «ورود پیام بانکی».
function SmsGuideCard() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <BellRing className="h-4 w-4 text-emerald-700" />
          ثبت پیام بانک — واریز و برداشت خودکار
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-start gap-3 rounded-xl border border-emerald-300 bg-emerald-50 p-3 dark:border-emerald-500/40 dark:bg-emerald-950/40">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <div className="space-y-1 text-xs leading-5">
            <p>
              پیام یا نوتیفیکیشن واریز/برداشت بانک (مثل <span className="font-bold">بلوبانک</span>) را کپی کنید و در کادر
              «ورود پیام بانکی» پایین بچسبانید — نوع تراکنش، مبلغ، بانک، بابت و موجودی به‌طور خودکار تشخیص داده می‌شود
              و تراکنش به همان حساب بانکی وصل می‌شود.
            </p>
            <p className="text-muted-foreground">
              در اندروید می‌توانید از داخل برنامهٔ پیامک یا بلوبانک روی پیام <span className="font-bold">Share</span> بزنید و
              «حساب‌یار» را انتخاب کنید — پیام همین‌جا باز می‌شود.
            </p>
            <p className="text-muted-foreground">
              برای امنیت بیشتر، برنامه دیگر پیامک‌ها را مستقیم نمی‌خواند (بدون هیچ مجوز حساسی — تأیید گوگل‌پلی و Play Protect).
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

'''
lines[a:b] = guide.strip("\n").split("\n")

src = "\n".join(lines)

# ─── استفادهٔ SmsGuideCard به‌جای SmsAutoSync در SmsSection ───
src = src.replace("      {/* خواندن خودکار پیامک (فقط در اپ اندروید نمایش داده می‌شود) */}\n      <SmsAutoSync accounts={accounts} />",
                  "      {/* راهنمای ثبت پیام بانک — بدون مجوز (v2.16) */}\n      <SmsGuideCard />")

# ─── SmsSection: intake پیام Share‌شده + تاریخ پیام هنگام ثبت ───
# ۱) بعد از تعریف stateها، useEffect دریافت share
anchor = '  const pending = (logs || []).filter((l) => l.status === "pending");'
share_hook = '''  // ─── دریافت پیام Share‌شده از اندروید (v2.16) ───
  // سرد: متن هنگام باز شدن برنامه از پلاگین خوانده می‌شود؛ گرم: رویداد window می‌آید
  useEffect(() => {
    const applyText = (t: string) => {
      const v = String(t || "").trim();
      if (!v) return;
      setText(v);
      try {
        const p = parseBankSms(v);
        setPreview({ type: p.type, amount: p.amount, bankName: p.bankName, confidence: p.confidence });
        if (p.confidence < 0.55) {
          toast({ title: "تشخیص نامطمئن", description: "نوع یا مبلغ کاملاً مشخص نشد — بررسی کنید و «افزودن به صف» را بزنید.", variant: "destructive" });
        } else {
          toast({ title: "پیام بانک دریافت شد", description: "نوع و مبلغ تشخیص داده شد — «افزودن به صف» را بزنید." });
        }
      } catch {
        // ignore
      }
    };
    void (async () => {
      if (isNativeAndroid()) {
        try {
          const r = await consumeSharedText();
          if (r?.text) applyText(r.text);
        } catch {
          // ignore
        }
      }
    })();
    const onShare = (e: Event) => {
      const t = (e as CustomEvent<{ text?: string }>).detail?.text;
      if (t) applyText(t);
    };
    window.addEventListener("hesabShareText", onShare);
    return () => window.removeEventListener("hesabShareText", onShare);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

'''
assert anchor in src, "pending anchor not found"
src = src.replace(anchor, share_hook + anchor)

# ۲) ثبت تراکنش از صف — تاریخ پیام (اگر تشخیص داده شد) همراه بدنه برود
old_body = """                actionMutation.mutate({
                  id: importLog.id,
                  body: {
                    action: "import",
                    type: importType,
                    amount: toStoredAmount(parseMoneyInput(importAmount)),
                    purpose: importPurpose || null,
                    bankAccountId: importAccount || null,
                  },
                })"""
new_body = """                actionMutation.mutate({
                  id: importLog.id,
                  body: {
                    action: "import",
                    type: importType,
                    amount: toStoredAmount(parseMoneyInput(importAmount)),
                    purpose: importPurpose || null,
                    bankAccountId: importAccount || null,
                    date: importLog.parsedDate || null,
                  },
                })"""
assert old_body in src, "import body not found"
src = src.replace(old_body, new_body)

# ۳) متن راهنمای کادر ورود پیام — اشاره به بلوبانک
old_desc = "            پیامک واریز یا برداشت بانک را کپی و اینجا بچسبانید. نرم‌افزار به‌طور خودکار نوع (واریز/برداشت)، مبلغ و نام بانک را تشخیص می‌دهد.\n            در نسخه اندروید، پیامک‌ها به‌صورت خودکار خوانده و وارد می‌شوند."
new_desc = "            پیام یا نوتیفیکیشن واریز/برداشت بانک (مثلاً بلوبانک) را کپی و اینجا بچسبانید — یا در اندروید روی پیام Share بزنید و حساب‌یار را انتخاب کنید.\n            نوع (واریز/برداشت)، مبلغ، بانک، بابت و موجودی به‌طور خودکار تشخیص داده می‌شود و تاریخ شمسی داخل پیام هم به تراکنش اعمال می‌شود."
assert old_desc in src, "desc not found"
src = src.replace(old_desc, new_desc)

# ۴) placeholder نمونهٔ بلو
old_ph = 'placeholder="مثال: بانک ملت: برداشت مبلغ 500,000 ریال از حساب 1234 بابت خرید"'
new_ph = 'placeholder="مثال بلوبانک: علی عزیز، 220,000 ریال بابت خرید شارژ از حساب شما کم شد — موجودی: 50,025,971 ریال"'
assert old_ph in src, "placeholder not found"
src = src.replace(old_ph, new_ph)

open(p, "w", encoding="utf-8").write(src)
print("OK — banks.tsx patched")
