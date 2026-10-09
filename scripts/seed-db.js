(async () => {
// Seed IndexedDB with realistic user data to reproduce the transactions-tab bug
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

// categories: root + 3-level subtree (like the user's new v2.8.0 data)
const cFood = { id: "cat-food", name: "خوراک", type: "expense", color: "#ef4444", icon: "Tag", parentId: null, allowSub: true, createdAt: iso(now-9e8), updatedAt: iso(now-9e8), _count: { transactions: 2 } };
const cFoodSub = { id: "cat-food-sub", name: "خواربار", type: "expense", color: "#ef4444", icon: "Tag", parentId: "cat-food", allowSub: true, createdAt: iso(now-8e8), updatedAt: iso(now-8e8), _count: { transactions: 1 } };
const cFoodSub2 = { id: "cat-food-sub2", name: "میوه", type: "expense", color: "#ef4444", icon: "Tag", parentId: "cat-food-sub", allowSub: true, createdAt: iso(now-7e8), updatedAt: iso(now-7e8), _count: { transactions: 0 } };
const cFoodSub3 = { id: "cat-food-sub3", name: "تابستانه", type: "expense", color: "#ef4444", icon: "Tag", parentId: "cat-food-sub2", allowSub: false, createdAt: iso(now-6e8), updatedAt: iso(now-6e8), _count: { transactions: 0 } };
const cSalary = { id: "cat-salary", name: "حقوق", type: "income", color: "#10b981", icon: "Tag", parentId: null, allowSub: true, createdAt: iso(now-9e8), updatedAt: iso(now-9e8), _count: { transactions: 1 } };

const acc = { id: "acc-melli", name: "ملی — ۷۲۶۶", bankName: "ملی", initialBalance: 5000000, smsSender: "+985000142", smsBalance: 66663400, smsBalanceDate: iso(now-4e7), createdAt: iso(now-9e8), updatedAt: iso(now-9e8) };

const txs = [
  { id: "tx-1", type: "expense", amount: 473000, purpose: "خرید ماهانه خواربار", categoryId: "cat-food-sub", bankAccountId: "acc-melli", date: iso(now-3.5e7), source: "manual", rawSms: null, createdAt: iso(now-3.5e7), updatedAt: iso(now-3.5e7) },
  { id: "tx-2", type: "income", amount: 12000000, purpose: null, categoryId: "cat-salary", bankAccountId: "acc-melli", date: iso(now-2.4e7), source: "sms", rawSms: "واریز حقوق 12,000,000 ریال مانده: 66,663,400 ریال", createdAt: iso(now-2.4e7), updatedAt: iso(now-2.4e7) },
  { id: "tx-3", type: "expense", amount: 2000000, purpose: "کارت به کارت", categoryId: "cat-food", bankAccountId: "acc-melli", date: iso(now-1.2e7), source: "sms", rawSms: "انتقال کارت به کارت -2,000,000 ریال", createdAt: iso(now-1.2e7), updatedAt: iso(now-1.2e7) },
  { id: "tx-4", type: "income", amount: 500000, purpose: null, categoryId: null, bankAccountId: "acc-melli", date: iso(now-1e5), source: "sms", rawSms: "واریز 500,000 ریال", createdAt: iso(now-1e5), updatedAt: iso(now-1e5) },
];
for (const c of [cFood, cFoodSub, cFoodSub2, cFoodSub3, cSalary]) await put(db, "categories", c);
await put(db, "bankAccounts", acc);
for (const t of txs) await put(db, "transactions", t);
const out = { cats: (await getAll(db, "categories")).length, accs: (await getAll(db, "bankAccounts")).length, txs: (await getAll(db, "transactions")).length };
return out;
})()
