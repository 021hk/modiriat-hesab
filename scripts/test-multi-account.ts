// تست تفکیک چند حساب بانکی از یک شمارهٔ فرستنده (v2.14) — اجرا: bun scripts/test-multi-account.ts
// سناریو: از یک شمارهٔ بانک (مثلاً 9999) دو حساب داریم؛ پیامک هر حساب باید به حساب درست برود.
import { matchAccountByRef, scoreAccountRefMatch, senderMatches, type AccountLike } from "../src/lib/sms-match";
import { judgeSms } from "../src/lib/sms-sync";
import type { BankAccount } from "../src/lib/client-api";

let pass = 0;
let failCount = 0;

function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    pass++;
  } else {
    failCount++;
    console.log(`✗ ${name}\n   expected: ${JSON.stringify(expected)}\n   actual:   ${JSON.stringify(actual)}`);
  }
}

// دو حساب از یک بانک با یک شمارهٔ فرستنده — فقط شماره حساب/کارت فرق دارد
const accA: AccountLike = { id: "A", cardNumber: "6037997512345678", accountNumber: "13972872", iban: null };
const accB: AccountLike = { id: "B", cardNumber: "6037997587654321", accountNumber: "88112233", iban: null };

// ─── امتیازدهی ───

check("تطبیق کامل بیشترین امتیاز", scoreAccountRefMatch("13972872", "13972872") > scoreAccountRefMatch("1397287", "13972872"), true);
check("امتیاز تطبیق ۴ رقمی کم", scoreAccountRefMatch("13972872", "1234"), 0);
check("پسوند بلندتر امتیاز بیشتر", scoreAccountRefMatch("13972872", "872") >= 0, true);

// ─── تطبیق مستقیم: هر پیامک به حساب خودش ───

check("پیامک حساب A → A", matchAccountByRef([accA, accB], "13972872", null), "A");
check("پیامک حساب B → B", matchAccountByRef([accA, accB], "88112233", null), "B");
check("پیامک کارت A → A", matchAccountByRef([accA, accB], "6037997512345678", null), "A");
check("شناسهٔ گروهی A با نقطه → A", matchAccountByRef([accA, accB], "777.888.13972872.1", "2872"), "A");
check("شناسهٔ گروهی B با نقطه → B", matchAccountByRef([accA, accB], "777.888.88112233.9", "2233"), "B");

// حساب غریبه از همان بانک → رد
check("حساب سوم غریبه → null", matchAccountByRef([accA, accB], "55667788", null), null);

// tail ۴ رقمی متمایز
check("۴ رقم آخر A", matchAccountByRef([accA, accB], null, "5678"), "A");
check("۴ رقم آخر B", matchAccountByRef([accA, accB], null, "4321"), "B");
check("۴ رقم آخر غریبه → null", matchAccountByRef([accA, accB], null, "9999"), null);

// ─── اولویت: تطبیق بلندتر بر تطبیق کوتاه‌تر ───
// حسابی با پسوند کوتاه‌تر هم به‌طور اتفاقی می‌خواند (مثلاً حساب دیگری با شمارهٔ 2872)
const accC: AccountLike = { id: "C", cardNumber: null, accountNumber: "2872", iban: null };
check("بلندترین تطبیق برنده است (A=13972872 در برابر C=2872)", matchAccountByRef([accC, accA], "13972872", null), "A");

// ─── judgeSms: دو حساب یک شمارهٔ فرستنده ───

const mkAccount = (id: string, accountNumber: string, cardNumber: string | null): BankAccount =>
  ({
    id,
    name: id,
    bankName: "ملت",
    accountNumber,
    cardNumber,
    iban: null,
    smsSender: "9999",
    initialBalance: 0,
    color: "#000",
    isArchived: false,
    createdAt: "",
    updatedAt: "",
  }) as BankAccount;

const accounts2 = [mkAccount("A", "13972872", "6037997512345678"), mkAccount("B", "88112233", "6037997587654321")];

const j1 = judgeSms({
  sender: "9999",
  text: "777.888.13972872.1\n-473,000\n07/10_02:10\nمانده: 66,663,400",
  accounts: accounts2,
  autoImport: true,
});
check("پیامک حساب A → accountId=A", [j1.verdict, j1.accountId], ["auto_import", "A"]);

const j2 = judgeSms({
  sender: "+989999",
  text: "777.888.88112233.9\n-120,000\n07/10_03:10\nمانده: 10,000,000",
  accounts: accounts2,
  autoImport: true,
});
check("پیامک حساب B → accountId=B (همان شمارهٔ فرستنده)", [j2.verdict, j2.accountId], ["auto_import", "B"]);

const j3 = judgeSms({
  sender: "9999",
  text: "777.888.55667788.2\n-300,000\nمانده: 5,000,000",
  accounts: accounts2,
  autoImport: true,
});
check("پیامک حساب سوم غریبه → rejected_foreign", j3.verdict, "rejected_foreign");

// فرمت «ملت**2872» — فقط ۴ رقم آخر
const j4 = judgeSms({
  sender: "9999",
  text: "ملت**2872 برداشت 150,000 ریال — مانده: 60,000,000",
  accounts: accounts2,
  autoImport: true,
});
check("۴ رقم آخر «ملت**2872» → A", j4.accountId, "A");

const j5 = judgeSms({
  sender: "9999",
  text: "ملت**2233 برداشت 90,000 ریال — مانده: 9,000,000",
  accounts: accounts2,
  autoImport: true,
});
check("۴ رقم آخر «ملت**2233» → B", j5.accountId, "B");

// ─── فرستنده یکسان می‌خواند ولی حساب‌ها تفکیک می‌شوند ───

check("فرستنده 9999 با هر دو حساب می‌خواند", senderMatches("9999", ["9999"]), true);

console.log(`\nنتایج: ${pass} درست، ${failCount} غلط`);
if (failCount > 0) process.exit(1);
