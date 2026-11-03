(async () => {
// Seed v2.14.0 — اقساط و چک + دستیار + دو حساب از یک بانک (تست تفکیک پیامک)
async function openDb() {
  return new Promise((res, rej) => {
    const req = indexedDB.open("hesabyar-db", 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of ["categories", "bankAccounts", "transactions", "debts", "attachments", "smsLogs", "installments"]) {
        if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "key" });
    };
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

for (const s of ["categories", "bankAccounts", "transactions", "debts", "attachments", "smsLogs", "installments", "meta"]) {
  try { await clear(db, s); } catch (e) {}
}

const cFood = { id: "cat-food", name: "خواربار", type: "expense", color: "#ef4444", icon: "Tag", parentId: null, allowSub: true, createdAt: iso(now-9e8), updatedAt: iso(now-9e8) };
const cLiving = { id: "cat-living", name: "هزینه‌های جاری", type: "expense", color: "#f59e0b", icon: "House", parentId: null, allowSub: true, createdAt: iso(now-9e8), updatedAt: iso(now-9e8) };
const cSalary = { id: "cat-salary", name: "حقوق", type: "income", color: "#10b981", icon: "Banknote", parentId: null, allowSub: true, createdAt: iso(now-9e8), updatedAt: iso(now-9e8) };
// دو حساب از یک بانک با یک شمارهٔ فرستنده — تفکیک با شمارهٔ حساب
const accMelli1 = { id: "acc-melli-1", name: "ملی — ۷۲۶۶", bankName: "ملی", accountNumber: "13972872", cardNumber: "6037997512345678", iban: null, smsSender: "9999", initialBalance: 0, smsBalance: 66663400, smsBalanceDate: iso(now-4e7), color: "#0ea5e9", isArchived: false, createdAt: iso(now-9e8), updatedAt: iso(now-9e8) };
const accMelli2 = { id: "acc-melli-2", name: "ملی پس‌انداز — ۴۳۲۱", bankName: "ملی", accountNumber: "88112233", cardNumber: "6037997587654321", iban: null, smsSender: "9999", initialBalance: 0, smsBalance: 9500000, smsBalanceDate: iso(now-4e7), color: "#8b5cf6", isArchived: false, createdAt: iso(now-9e8), updatedAt: iso(now-9e8) };
await put(db, "categories", cFood);
await put(db, "categories", cLiving);
await put(db, "categories", cSalary);
await put(db, "bankAccounts", accMelli1);
await put(db, "bankAccounts", accMelli2);

// اشخاص (برای حفظ سناریوی بدهی‌ها)
const debts = [
  { id: "p-ali", name: "علی محمدی", type: "debtor", amount: 0, paidAmount: 0, openingBalance: 3000000, phone: "09121234567", description: "قرض دستی", dueDate: null, isSettled: false, attachments: [], createdAt: iso(now-5e7), updatedAt: iso(now-2e7) },
  { id: "p-reza", name: "رضا کریمی", type: "creditor", amount: 0, paidAmount: 0, openingBalance: -1500000, phone: "09351112233", description: null, dueDate: null, isSettled: false, attachments: [], createdAt: iso(now-4e7), updatedAt: iso(now-4e7) },
];
for (const d of debts) await put(db, "debts", d);

// تراکنش‌ها — چند مورد «بدون دسته» در بازه‌های مختلف برای تست اقدام دستیار
const txs = [
  { id: "t1", type: "expense", kind: "expense", amount: 473000, purpose: "خرید ماهانه خواربار", categoryId: "cat-food", bankAccountId: "acc-melli-1", date: iso(now-0.5e7), source: "manual", rawSms: null, debtId: null, debtName: null, createdAt: iso(now-0.5e7), updatedAt: iso(now-0.5e7) },
  { id: "t2", type: "expense", kind: "expense", amount: 250000, purpose: "خرید روزانه", categoryId: null, bankAccountId: "acc-melli-1", date: iso(now-0.4e7), source: "sms", rawSms: "ملت**7266 برداشت 250,000 ریال", debtId: null, debtName: null, createdAt: iso(now-0.4e7), updatedAt: iso(now-0.4e7) },
  { id: "t3", type: "income", kind: "income", amount: 5000000, purpose: "حقوق آبان", categoryId: "cat-salary", bankAccountId: "acc-melli-1", date: iso(now-0.6e7), source: "manual", rawSms: null, debtId: null, debtName: null, createdAt: iso(now-0.6e7), updatedAt: iso(now-0.6e7) },
  { id: "t4", type: "expense", kind: "expense", amount: 320000, purpose: "قسط ماهانه فروشگاه", categoryId: null, bankAccountId: "acc-melli-2", date: iso(now-0.3e7), source: "sms", rawSms: null, debtId: null, debtName: null, createdAt: iso(now-0.3e7), updatedAt: iso(now-0.3e7) },
  { id: "t5", type: "expense", kind: "expense", amount: 180000, purpose: "پیک", categoryId: null, bankAccountId: "acc-melli-1", date: iso(now-0.2e7), source: "manual", rawSms: null, debtId: null, debtName: null, createdAt: iso(now-0.2e7), updatedAt: iso(now-0.2e7) },
  { id: "t6", type: "expense", kind: "loan_given", amount: 2000000, purpose: null, categoryId: null, bankAccountId: "acc-melli-1", date: iso(now-2.0e7), source: "manual", rawSms: null, debtId: "p-ali", debtName: "علی محمدی", createdAt: iso(now-2e7), updatedAt: iso(now-2e7) },
  { id: "t7", type: "income", kind: "claim_received", amount: 1000000, purpose: null, categoryId: null, bankAccountId: "acc-melli-1", date: iso(now-1.2e7), source: "manual", rawSms: null, debtId: "p-ali", debtName: "علی محمدی", createdAt: iso(now-1.2e7), updatedAt: iso(now-1.2e7) },
];
for (const t of txs) await put(db, "transactions", t);

// اقساط و چک‌ها — ۴ سناریو: نزدیک، آینده، گذشته، پرداخت‌شده + کمبود موجودی
const installments = [
  { id: "i1", title: "قسط وام مسکن", kind: "installment", amount: 12000000, dueDate: iso(now + 1.5 * 864e5), counterparty: "بانک مسکن", bankAccountId: "acc-melli-1", paid: false, paidAt: null, notes: null, createdAt: iso(now-1e7), updatedAt: iso(now-1e7) },
  { id: "i2", title: "چک اجاره — آقای رضایی", kind: "check", amount: 85000000, dueDate: iso(now + 6 * 864e5), counterparty: "آقای رضایی", bankAccountId: "acc-melli-2", paid: false, paidAt: null, notes: null, createdAt: iso(now-1e7), updatedAt: iso(now-1e7) },
  { id: "i3", title: "قسط موبایل (سررسید گذشته)", kind: "installment", amount: 2200000, dueDate: iso(now - 3 * 864e5), counterparty: "بانک سامان", bankAccountId: "acc-melli-2", paid: false, paidAt: null, notes: null, createdAt: iso(now-1e7), updatedAt: iso(now-1e7) },
  { id: "i4", title: "چک خرید قبلی (پرداخت‌شده)", kind: "check", amount: 1500000, dueDate: iso(now - 10 * 864e5), counterparty: "فروشگاه", bankAccountId: "acc-melli-1", paid: true, paidAt: iso(now - 9 * 864e5), notes: null, createdAt: iso(now-1e7), updatedAt: iso(now - 9 * 864e5) },
];
for (const i of installments) await put(db, "installments", i);

// تنظیمات — بدون کلید Gemini (برای تست حالت «کلید تنظیم نشده»)
await put(db, "meta", { key: "schemaVersion", value: 3 });
await put(db, "meta", { key: "notifSettings", value: { enabled: true, daysBefore: 2, hour: 9, lowBalanceWarn: true } });

const out = {
  cats: (await getAll(db, "categories")).length,
  accs: (await getAll(db, "bankAccounts")).length,
  txs: (await getAll(db, "transactions")).length,
  debts: (await getAll(db, "debts")).length,
  insts: (await getAll(db, "installments")).length,
};
return out;
})()
