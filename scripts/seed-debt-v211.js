(async () => {
// Seed v2.11.0 — سناریوی بازطراحی بدهی/طلب + عنوان خودکار تراکنش‌ها
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

for (const s of ["categories", "bankAccounts", "transactions", "debts", "attachments", "smsLogs"]) {
  try { await clear(db, s); } catch (e) {}
}

const cFood = { id: "cat-food", name: "خوراک", type: "expense", color: "#ef4444", icon: "Tag", parentId: null, allowSub: true, createdAt: iso(now-9e8), updatedAt: iso(now-9e8) };
const acc = { id: "acc-melli", name: "ملی — ۷۲۶۶", bankName: "ملی", initialBalance: 5000000, smsSender: "+985000142", smsBalance: 66663400, smsBalanceDate: iso(now-4e7), createdAt: iso(now-9e8), updatedAt: iso(now-9e8) };
await put(db, "categories", cFood);
await put(db, "bankAccounts", acc);

// رکوردهای بدهی — علی دو رکورد دارد (طلب باز + بدهی تسویه‌شده) تا گروه‌بندی اشخاص تست شود
const debts = [
  { id: "debt-ali-1", name: "علی محمدی", type: "debtor", amount: 5000000, paidAmount: 1000000, phone: "09121234567", description: "قرض دستی + تراکنش‌ها", dueDate: null, isSettled: false, attachments: [], createdAt: iso(now-5e7), updatedAt: iso(now-2e7) },
  { id: "debt-ali-2", name: "علی محمدی", type: "creditor", amount: 2000000, paidAmount: 2000000, phone: null, description: "قرضی که از علی گرفتم — تسویه شد", dueDate: null, isSettled: true, attachments: [], createdAt: iso(now-4.5e7), updatedAt: iso(now-1.5e7) },
  { id: "debt-reza", name: "رضا کریمی", type: "creditor", amount: 1500000, paidAmount: 0, phone: "09351112233", description: "قرض گرفته بودم — بدون تراکنش متصل", dueDate: null, isSettled: false, attachments: [], createdAt: iso(now-4e7), updatedAt: iso(now-4e7) },
  { id: "debt-maryam", name: "مریم احمدی", type: "debtor", amount: 800000, paidAmount: 800000, phone: null, description: null, dueDate: null, isSettled: true, attachments: [], createdAt: iso(now-3e7), updatedAt: iso(now-3e7) },
];
for (const d of debts) await put(db, "debts", d);

// تراکنش‌های متصل — purpose خالی تا عنوان خودکار نمایش داده شود
const txs = [
  { id: "dtx-1", type: "expense", amount: 2000000, purpose: null, categoryId: null, bankAccountId: "acc-melli", date: iso(now-2.0e7), source: "manual", rawSms: null, debtId: "debt-ali-1", debtName: "علی محمدی", createdAt: iso(now-2e7), updatedAt: iso(now-2e7) },
  { id: "dtx-2", type: "income", amount: 1000000, purpose: null, categoryId: null, bankAccountId: "acc-melli", date: iso(now-1.2e7), source: "manual", rawSms: null, debtId: "debt-ali-1", debtName: "علی محمدی", createdAt: iso(now-1.2e7), updatedAt: iso(now-1.2e7) },
  { id: "dtx-3", type: "expense", amount: 2000000, purpose: null, categoryId: null, bankAccountId: "acc-melli", date: iso(now-1.5e7), source: "manual", rawSms: null, debtId: "debt-ali-2", debtName: "علی محمدی", createdAt: iso(now-1.5e7), updatedAt: iso(now-1.5e7) },
  { id: "dtx-4", type: "expense", amount: 473000, purpose: "خرید ماهانه خواربار", categoryId: "cat-food", bankAccountId: "acc-melli", date: iso(now-0.5e7), source: "manual", rawSms: null, debtId: null, debtName: null, createdAt: iso(now-0.5e7), updatedAt: iso(now-0.5e7) },
];
for (const t of txs) await put(db, "transactions", t);

const out = {
  cats: (await getAll(db, "categories")).length,
  accs: (await getAll(db, "bankAccounts")).length,
  txs: (await getAll(db, "transactions")).length,
  debts: (await getAll(db, "debts")).length,
};
return out;
})()
