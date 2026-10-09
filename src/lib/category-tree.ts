// ─── درخت دسته‌بندی (خالص — هم سمت UI هم تست) ───
// حداکثر عمق: ۱ ریشه + ۳ زیرشاخه = ۴ سطح
// «زیرشاخه فعال» (allowSub): فقط روی دسته‌ای که این کلید روشن باشد می‌توان فرزند افزود

import type { Category } from "@/lib/client-api";

export const MAX_CATEGORY_DEPTH = 4;

export interface CategoryNode {
  category: Category;
  depth: number; // ۱ = ریشه
  children: CategoryNode[];
}

export interface FlatCategory {
  category: Category;
  depth: number;
  label: string; // با تودرتوی «— » برای نمایش در Select
}

// عمق یک دسته با پیمایش زنجیره والدین — اگر زنجیره شکسته باشد (والد گم‌شده) همان‌جا تمام می‌شود
export function categoryDepthById(cats: Pick<Category, "id" | "parentId">[], id: string): number {
  const byId = new Map(cats.map((c) => [c.id, c]));
  let depth = 1;
  let cur = byId.get(id);
  const seen = new Set<string>([id]);
  while (cur?.parentId) {
    if (seen.has(cur.parentId)) break; // محافظت از حلقه
    depth++;
    seen.add(cur.parentId);
    cur = byId.get(cur.parentId);
  }
  return depth;
}

// آیا می‌توان به این دسته فرزند افزود؟ (کلید زیرشاخه فعال + هنوز به سقف عمق نرسیده باشد)
export function canHaveChild(
  cat: Pick<Category, "id" | "parentId" | "allowSub"> | undefined,
  allCats: Pick<Category, "id" | "parentId">[]
): boolean {
  if (!cat) return false;
  if (cat.allowSub === false) return false; // کاربر زیرشاخه را غیرفعال کرده
  return categoryDepthById(allCats, cat.id) < MAX_CATEGORY_DEPTH;
}

export function buildCategoryTree(cats: Category[]): CategoryNode[] {
  const byParent = new Map<string | null, Category[]>();
  for (const c of cats) {
    const key = c.parentId || null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(c);
  }
  const build = (parentId: string | null, depth: number): CategoryNode[] => {
    return (byParent.get(parentId) || []).map((c) => ({
      category: c,
      depth,
      children: build(c.id, depth + 1),
    }));
  };
  return build(null, 1);
}

// پیمایش عمقی با برچسب تودرتو برای Select‌ها (ترتیب ثابت: ورودی + فرزندان پشت سر والد)
export function flattenCategoryTree(cats: Category[]): FlatCategory[] {
  const out: FlatCategory[] = [];
  const walk = (nodes: CategoryNode[]) => {
    for (const n of nodes) {
      out.push({
        category: n.category,
        depth: n.depth,
        label: (n.depth > 1 ? "— ".repeat(n.depth - 1) : "") + n.category.name,
      });
      walk(n.children);
    }
  };
  walk(buildCategoryTree(cats));
  return out;
}
