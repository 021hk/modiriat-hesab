(async () => {
// Seed v2.12.0 — مدل شخص‌محور: هر تراکنش یک kind + باقی‌مانده شخص = مانده اولیه + گردش بدهی − گردش طلب
async function openDb() {
  return new Promise((res, rej) => {
    const req = indexedDB.open("hesabyar-db");
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
function put(db, store, val) {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(val);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}
function clear(db, store) {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).clear();
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}
function getAll(db, store) {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, "readonly");
    const r = tx.objectStore(store).getAll();
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
const db = await openDb();
const now = Date.now();
const iso = (d) => new Date(d).toISOString();

for (const s of ["categories", "bankAccounts", "transactions", "debts", "attachments", "smsLogs", "meta"]) {
  try { await clear(db, s); } catch (e) {}
}

const cFood = { id: "cat-food", name: "خواربار", type: "expense", color: "#ef4444", icon: "Tag", parentId: null, allowSub: true, createdAt: iso(now-9e8), updatedAt: iso(now-9e8) };
const acc = { id: "acc-melli", name: "ملی — ۷۲۶۶", bankName: "ملی", initialBalance: 5000000, smsSender: "+985000142", smsBalance: 66663400, smsBalanceDate: iso(now-4e7), createdAt: iso(now-9e8), updatedAt: iso(now-9e8) };
await put(db, "categories", cFood);
await put(db, "bankAccounts", acc);

// اشخاص — مانده اولیه: علی +۳M طلب اولیه (او از قبل بدهکار بود)، رضا −۱.۵M بدهی اولیه، مریم صفر
const debts = [
  { id: "p-ali", name: "علی محمدی", type: "debtor", amount: 0, paidAmount: 0, openingBalance: 3000000, phone: "09121234567", description: "قرض دستی قبل از ثبت در برنامه", dueDate: null, isSettled: false, attachments: [], createdAt: iso(now-5e7), updatedAt: iso(now-2e7) },
  { id: "p-reza", name: "رضا کریمی", type: "creditor", amount: 0, paidAmount: 0, openingBalance: -1500000, phone: "09351112233", description: "قرض گرفته بودم قبل از نصب برنامه", dueDate: null, isSettled: false, attachments: [], createdAt: iso(now-4e7), updatedAt: iso(now-4e7) },
  { id: "p-maryam", name: "مریم احمدی", type: "debtor", amount: 0, paidAmount: 0, openingBalance: 0, phone: null, description: null, dueDate: null, isSettled: false, attachments: [], createdAt: iso(now-3e7), updatedAt: iso(now-3e7) },
];
for (const d of debts) await put(db, "debts", d);

// تراکنش‌ها — هر کدام فقط یک kind
// علی: net = ۳M + ۲M(خروج قرض) − ۱M(دریافت طلب) = +۴M → طلب
// رضا: net = −۱.۵M + ۰.۵M(پرداخت بدهی) − ۰.۸M(دریافت بدهی) = −۱.۸M → بدهی
const txs = [
  // هزینه/درآمد خالص — در آمار مالی حساب می‌شوند
  { id: "t1", type: "expense", kind: "expense", amount: 473000, purpose: "خرید ماهانه خواربار", categoryId: "cat-food", bankAccountId: "acc-melli", date: iso(now-0.5e7), source: "manual", rawSms: null, debtId: null, debtName: null, createdAt: iso(now-0.5e7), updatedAt: iso(now-0.5e7) },
  { id: "t2", type: "expense", kind: "expense", amount: 120000, purpose: "پیامک بانک ملی", categoryId: null, bankAccountId: "acc-melli", date: iso(now-0.4e7), source: "sms", rawSms: "ملی بانک**7266 برداشت 120,000 ریال مانده 66,663,400", debtId: null, debtName: null, createdAt: iso(now-0.4e7), updatedAt: iso(now-0.4e7) },
  { id: "t3", type: "income", kind: "income", amount: 5000000, purpose: "حقوق آبان", categoryId: null, bankAccountId: "acc-melli", date: iso(now-0.6e7), source: "manual", rawSms: null, debtId: null, debtName: null, createdAt: iso(now-0.6e7), updatedAt: iso(now-0.6e7) },
  // علی — بدهی/طلب
  { id: "t4", type: "expense", kind: "loan_given", amount: 2000000, purpose: null, categoryId: null, bankAccountId: "acc-melli", date: iso(now-2.0e7), source: "manual", rawSms: null, debtId: "p-ali", debtName: "علی محمدی", createdAt: iso(now-2e7), updatedAt: iso(now-2e7) },
  { id: "t5", type: "income", kind: "claim_received", amount: 1000000, purpose: null, categoryId: null, bankAccountId: "acc-melli", date: iso(now-1.2e7), source: "manual", rawSms: null, debtId: "p-ali", debtName: "علی محمدی", createdAt: iso(now-1.2e7), updatedAt: iso(now-1.2e7) },
  // رضا — بدهی/طلب
  { id: "t6", type: "expense", kind: "debt_payment", amount: 500000, purpose: null, categoryId: null, bankAccountId: "acc-melli", date: iso(now-1.0e7), source: "manual", rawSms: null, debtId: "p-reza", debtName: "رضا کریمی", createdAt: iso(now-1.0e7), updatedAt: iso(now-1.0e7) },
  { id: "t7", type: "income", kind: "loan_received", amount: 800000, purpose: null, categoryId: null, bankAccountId: "acc-melli", date: iso(now-0.8e7), source: "manual", rawSms: null, debtId: "p-reza", debtName: "رضا کریمی", createdAt: iso(now-0.8e7), updatedAt: iso(now-0.8e7) },
];
for (const t of txs) await put(db, "transactions", t);

// مهاجرت لازم نیست — داده با مدل جدید نوشته شده
await put(db, "meta", { key: "schemaVersion", value: 3 });

const out = {
  cats: (await getAll(db, "categories")).length,
  accs: (await getAll(db, "bankAccounts")).length,
  txs: (await getAll(db, "transactions")).length,
  debts: (await getAll(db, "debts")).length,
};
return out;
})()
