#!/usr/bin/env bash
# تأیید رفتار دکمهٔ برگشت در نسخهٔ وب (همان منطقی که در APK اجرا می‌شود)
set -u
cd /home/z/my-project

PORT=3311 bun scripts/static-server.ts > /tmp/ss.log 2>&1 &
SRV=$!
for i in 1 2 3 4 5 6 7 8 9 10; do
  curl -s -o /dev/null http://localhost:3311/ && break
  sleep 1
done
curl -s -o /dev/null -w "server ready: %{http_code}\n" http://localhost:3311/

CLEANUP() { kill $SRV 2>/dev/null; }
trap CLEANUP EXIT

AB() { agent-browser --session backtest "$@"; }

AB set viewport 414 896
AB open http://localhost:3311/
AB wait 1800

ACTIVE='document.querySelector("nav button.text-emerald-700")?.textContent?.trim() || "none"'

echo "T0 active (expect داشبورد): $(AB eval "$ACTIVE")"

# برو به تنظیمات، بعد تراکنش‌ها
AB eval "(() => { const b=[...document.querySelectorAll('nav button')];b.find(x=>x.textContent.includes('تنظیمات')).click(); return 'ok'; })()" > /dev/null
AB wait 400
echo "T1 active (expect تنظیمات): $(AB eval "$ACTIVE")"

AB eval "(() => { const b=[...document.querySelectorAll('nav button')];b.find(x=>x.textContent.includes('تراکنش')).click(); return 'ok'; })()" > /dev/null
AB wait 400
echo "T2 active (expect تراکنش): $(AB eval "$ACTIVE")"

# برگشت گوشی → باید به تنظیمات برگردد (نه خارج شدن)
AB back > /dev/null
AB wait 400
echo "T3 after back (expect تنظیمات): $(AB eval "$ACTIVE")"

# برگشت دوم → داشبورد
AB back > /dev/null
AB wait 400
echo "T4 after back (expect داشبورد): $(AB eval "$ACTIVE")"

echo "T5 url still app: $(AB eval 'location.origin+location.pathname') | history.length=$(AB eval 'history.length')"

# دیالوگ تراکنش سریع → برگشت باید اول دیالوگ را ببندد، نه تعویض تب
AB eval "(() => { const h=[...document.querySelectorAll('header button')];h.find(x=>x.textContent.includes('تراکنش')).click(); return 'ok'; })()" > /dev/null
AB wait 500
echo "T6 dialog open count (expect 1): $(AB eval 'document.querySelectorAll("[role=dialog][data-state=open]").length')"
AB back > /dev/null
AB wait 500
echo "T7 dialog after back (expect 0): $(AB eval 'document.querySelectorAll("[role=dialog][data-state=open]").length')"
echo "T8 active still (expect داشبورد): $(AB eval "$ACTIVE")"

# پنل گوی هوشمند → برگشت باید پنل را ببندد (گوی با PointerEvent کار می‌کند)
AB eval '(() => { const orb = document.querySelector("button[aria-label=\"دستیار هوشمند\"]"); if (!orb) return "notfound"; const r = orb.getBoundingClientRect(); const o = { bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse", isPrimary: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }; orb.dispatchEvent(new PointerEvent("pointerdown", o)); orb.dispatchEvent(new PointerEvent("pointerup", o)); return "ok"; })()' > /dev/null
AB wait 500
echo "T9 orb panel open: $(AB eval 'document.body.innerText.includes("دستیار هوشمند حساب") ? 1 : 0')"
AB back > /dev/null
AB wait 500
echo "T10 orb panel after back (expect 0): $(AB eval 'document.body.innerText.includes("دستیار هوشمند حساب") ? 1 : 0')"
echo "T11 active after orb close (expect داشبورد): $(AB eval "$ACTIVE")"

echo "--- console errors ---"
AB errors
AB close
