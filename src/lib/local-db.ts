// لایه داده محلی — IndexedDB روی خود دستگاه (کاملاً آفلاین، بدون سرور)
// نسخه ۲.۲: نام دیتابیس جدید — داده‌های آزمایشی/نمونه نسخه‌های قبلی کنار گذاشته می‌شوند
// و برنامه با داده‌های واقعی و خالی شروع می‌شود.

const DB_NAME = "hesabyar-db";
const DB_VERSION = 1;

export const STORES = {
  categories: "categories",
  bankAccounts: "bankAccounts",
  transactions: "transactions",
  debts: "debts",
  attachments: "attachments",
  smsLogs: "smsLogs",
  meta: "meta",
} as const;

export type StoreName = (typeof STORES)[keyof typeof STORES];

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB در این محیط در دسترس نیست"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      const idStores = [
        STORES.categories,
        STORES.bankAccounts,
        STORES.transactions,
        STORES.debts,
        STORES.attachments,
        STORES.smsLogs,
      ];
      for (const name of idStores) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORES.meta)) {
        db.createObjectStore(STORES.meta, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("خطا در باز کردن دیتابیس محلی"));
  });
  return dbPromise;
}

function getStore(store: StoreName, mode: IDBTransactionMode): Promise<IDBObjectStore> {
  return openDb().then((db) => db.transaction(store, mode).objectStore(store));
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("خطای دیتابیس محلی"));
  });
}

export async function dbGetAll<T>(store: StoreName): Promise<T[]> {
  const os = await getStore(store, "readonly");
  return wrap(os.getAll() as IDBRequest<T[]>);
}

export async function dbGet<T>(store: StoreName, id: string): Promise<T | undefined> {
  const os = await getStore(store, "readonly");
  return wrap(os.get(id) as IDBRequest<T | undefined>);
}

export async function dbPut(store: StoreName, value: unknown): Promise<void> {
  const os = await getStore(store, "readwrite");
  await wrap(os.put(value as never));
}

export async function dbDelete(store: StoreName, id: string): Promise<void> {
  const os = await getStore(store, "readwrite");
  await wrap(os.delete(id));
}

export async function dbClear(store: StoreName): Promise<void> {
  const os = await getStore(store, "readwrite");
  await wrap(os.clear());
}

// ─── متادیتا (تنظیمات کلید-مقدار) ───
export async function getMeta<T>(key: string): Promise<T | null> {
  const row = await dbGet<{ key: string; value: T }>(STORES.meta, key);
  return row ? row.value : null;
}

export async function setMeta<T>(key: string, value: T): Promise<void> {
  await dbPut(STORES.meta, { key, value });
}

// ─── شناسه یکتا ───
export function newId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  } catch {
    // ignore
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
