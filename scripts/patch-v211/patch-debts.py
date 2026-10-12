# -*- coding: utf-8 -*-
# بازطراحی debts.tsx برای v2.11.0 — جایگزینی DebtCard با PersonCard و بازنویسی Debts
# (ویرایش با ابزارهای Edit/Write روی متن فارسی پرخطاست — طبق درس worklog از python replace استفاده می‌شود)
import io, sys

SRC = "/home/z/my-project/src/components/hesab/debts.tsx"
CARD = "/home/z/my-project/scripts/patch-v211/person-card.part.tsx"
LIST = "/home/z/my-project/scripts/patch-v211/debts-list.part.tsx"

with io.open(SRC, "r", encoding="utf-8") as f:
    s = f.read()
with io.open(CARD, "r", encoding="utf-8") as f:
    card = f.read().rstrip("\n")
with io.open(LIST, "r", encoding="utf-8") as f:
    lst = f.read().rstrip("\n")

def replace_once(s, old, new, tag):
    if s.count(old) != 1:
        print("FAIL marker (%s): count=%d" % (tag, s.count(old)))
        sys.exit(1)
    return s.replace(old, new)

# ۱) آیکون ChevronDown
s = replace_once(
    s,
    '  TrendingDown,\n  Scale,\n} from "lucide-react";',
    '  TrendingDown,\n  Scale,\n  ChevronDown,\n} from "lucide-react";',
    "lucide",
)

# ۲) DropdownMenuSeparator
s = replace_once(
    s,
    "  DropdownMenuItem,\n  DropdownMenuTrigger,",
    "  DropdownMenuItem,\n  DropdownMenuSeparator,\n  DropdownMenuTrigger,",
    "dropdown",
)

# ۳) type Transaction
s = replace_once(
    s,
    'import { api, compressImage, type Debt, type Attachment } from "@/lib/client-api";',
    'import { api, compressImage, type Debt, type Attachment, type Transaction } from "@/lib/client-api";',
    "client-api import",
)

# ۴) import debt-utils بعد از بلوک format
fmt_end = '} from "@/lib/format";'
if s.count(fmt_end) != 1:
    print("FAIL marker (format import): count=%d" % s.count(fmt_end))
    sys.exit(1)
s = s.replace(
    fmt_end,
    fmt_end
    + '\nimport { personKey, summarizePerson, debtLinkLabel, debtRemaining } from "@/lib/debt-utils";',
)

# ۵) جایگزینی DebtCard + DebtDialogWrapper با PersonCard + DebtDialogWrapper جدید
start = s.find("function DebtCard({ debt }: { debt: Debt }) {")
end_marker = "// ─── کارت «تشخیص خودکار وضعیت» ───"
end = s.find(end_marker)
if start < 0 or end < 0 or end <= start:
    print("FAIL range (DebtCard): start=%d end=%d" % (start, end))
    sys.exit(1)
s = s[:start] + card + "\n\n" + s[end:]

# ۶) بازنویسی کامپوننت Debts
start = s.find("export function Debts() {")
end_marker2 = "function ToastPortalHelper() {"
end = s.find(end_marker2)
if start < 0 or end < 0 or end <= start:
    print("FAIL range (Debts): start=%d end=%d" % (start, end))
    sys.exit(1)
s = s[:start] + lst + "\n\n" + s[end:]

with io.open(SRC, "w", encoding="utf-8") as f:
    f.write(s)

print("OK — debts.tsx patched: %d chars" % len(s))
