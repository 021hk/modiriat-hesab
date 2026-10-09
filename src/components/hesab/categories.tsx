"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Tag, ListTree, CornerDownLeft } from "lucide-react";
import { api, type Category } from "@/lib/client-api";
import { buildCategoryTree, canHaveChild, categoryDepthById, MAX_CATEGORY_DEPTH, type CategoryNode } from "@/lib/category-tree";

const COLORS = [
  "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899",
  "#84cc16", "#f97316", "#6366f1", "#14b8a6", "#eab308", "#64748b",
];

function CategoryDialog({
  open,
  onOpenChange,
  editing,
  parent, // وقتی ست باشد یعنی «افزودن زیرشاخه به این دسته»
  allCount,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing?: Category | null;
  parent?: Category | null;
  allCount?: Category[];
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState(editing?.name || "");
  const [type, setType] = useState<"income" | "expense">(parent?.type || editing?.type || "expense");
  const [color, setColor] = useState(editing?.color || parent?.color || COLORS[0]);
  const [allowSub, setAllowSub] = useState<boolean>(editing ? editing.allowSub !== false : true);
  const hasChildren = editing && (allCount || []).some((c) => c.parentId === editing.id);
  const isChild = Boolean(parent || editing?.parentId);
  const editingDepth = editing ? categoryDepthById(allCount || [], editing.id) : 0;

  const mutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        return api.put(`/api/categories/${editing.id}`, { name, color, allowSub });
      }
      return api.post("/api/categories", {
        name,
        color,
        allowSub,
        type: parent ? undefined : type,
        parentId: parent?.id || undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      toast({ title: editing ? "دسته ویرایش شد" : parent ? "زیرشاخه ساخته شد" : "دسته جدید ساخته شد" });
      onOpenChange(false);
    },
    onError: (e: Error) => toast({ title: "خطا", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle>
            {editing ? "ویرایش دسته‌بندی" : parent ? `زیرشاخه برای «${parent.name}»` : "دسته‌بندی جدید"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          {/* نوع — فقط برای دسته ریشه؛ زیرشاخه نوع والد را به ارث می‌برد */}
          {!isChild ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType("expense")}
                className={`rounded-xl border-2 p-3 text-sm font-medium transition ${
                  type === "expense" ? "border-red-400 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300" : "border-border text-muted-foreground"
                }`}
              >
                هزینه
              </button>
              <button
                type="button"
                onClick={() => setType("income")}
                className={`rounded-xl border-2 p-3 text-sm font-medium transition ${
                  type === "income" ? "border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "border-border text-muted-foreground"
                }`}
              >
                درآمد
              </button>
            </div>
          ) : (
            <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              نوع این زیرشاخه از دسته والد به ارث می‌رسد ({parent ? (parent.type === "income" ? "درآمد" : "هزینه") : editing?.type === "income" ? "درآمد" : "هزینه"}).
            </p>
          )}
          <div className="grid gap-2">
            <Label>نام دسته</Label>
            <Input
              placeholder="مثلاً: خواربار، اجاره، حقوق"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>رنگ</Label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-7 w-7 rounded-full transition ${color === c ? "ring-2 ring-offset-2 ring-foreground" : ""}`}
                  style={{ backgroundColor: c }}
                  aria-label={`رنگ ${c}`}
                />
              ))}
            </div>
          </div>
          {/* کلید «زیرشاخه فعال» — اگر خاموش باشد نمی‌توان زیر این دسته زیرشاخه ساخت */}
          <div className="flex items-center justify-between rounded-xl border p-3">
            <div className="pl-3">
              <div className="text-sm font-medium">زیرشاخه فعال</div>
              <p className="text-[11px] leading-4 text-muted-foreground">
                {hasChildren
                  ? "این دسته زیرشاخه دارد — برای خاموش‌کردن اول زیرشاخه‌ها را حذف کنید"
                  : isChild
                    ? "تا عمق ۳ زیرشاخه می‌توان ساخت"
                    : "اگر روشن باشد می‌توانید زیر این دسته زیرشاخه بسازید"}
              </p>
            </div>
            <Switch
              checked={hasChildren ? true : allowSub}
              disabled={Boolean(hasChildren)}
              onCheckedChange={setAllowSub}
            />
          </div>
          {!editing && !isChild && (
            <p className="text-[11px] leading-4 text-muted-foreground">
              ساختار: دسته اصلی ← زیرشاخه ← زیرشاخه دوم ← زیرشاخه سوم (حداکثر ۳ زیرشاخه)
            </p>
          )}
          {editing && (
            <p className="text-[11px] leading-4 text-muted-foreground">
              عمق فعلی: {editingDepth} از {MAX_CATEGORY_DEPTH}
              {editingDepth >= MAX_CATEGORY_DEPTH && " — این دسته در عمق سقف است و دیگر زیرشاخه نمی‌گیرد"}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            انصراف
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !name.trim()}
            className="bg-emerald-700 hover:bg-emerald-800"
          >
            {mutation.isPending ? "..." : editing ? "ذخیره" : parent ? "ساخت زیرشاخه" : "ساخت دسته"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// یک ردیف دسته (بازگشتی برای زیرشاخه‌ها)
function CategoryRow({
  node,
  all,
  onEdit,
  onAddChild,
  onDelete,
}: {
  node: CategoryNode;
  all: Category[];
  onEdit: (c: Category) => void;
  onAddChild: (c: Category) => void;
  onDelete: (c: Category) => void;
}) {
  const c = node.category;
  const depth = node.depth;
  const canChild = canHaveChild(c, all);
  return (
    <div>
      <div
        className="flex items-center justify-between rounded-xl border p-3"
        style={{ marginInlineStart: `${(depth - 1) * 14}px` }}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${c.color}22`, color: c.color }}>
            <Tag className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <span className="truncate">{c.name}</span>
              {depth > 1 && (
                <Badge variant="outline" className="h-4 shrink-0 px-1 text-[10px]">
                  زیرشاخه {depth - 1}
                </Badge>
              )}
              {c.allowSub === false && (
                <span className="shrink-0 text-[10px] text-muted-foreground">(بدون زیرشاخه)</span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {c._count?.transactions ?? 0} تراکنش
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {canChild && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-emerald-700 dark:text-emerald-400"
              title="افزودن زیرشاخه"
              onClick={() => onAddChild(c)}
            >
              <CornerDownLeft className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(c)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onDelete(c)}
          >
            <Trash2 className="h-3.5 w-3.5 text-red-500" />
          </Button>
        </div>
      </div>
      {node.children.length > 0 && (
        <div className="mt-1.5 space-y-1.5">
          {node.children.map((ch) => (
            <CategoryRow key={ch.category.id} node={ch} all={all} onEdit={onEdit} onAddChild={onAddChild} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

export function Categories() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [addingChildOf, setAddingChildOf] = useState<Category | null>(null);

  const { data, isLoading } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: () => api.get("/api/categories"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.del(`/api/categories/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      toast({ title: "دسته حذف شد" });
    },
    onError: (e: Error) => toast({ title: "خطا", description: e.message, variant: "destructive" }),
  });

  const cats = data || [];
  const tree = buildCategoryTree(cats);
  const expenses = tree.filter((n) => n.category.type === "expense");
  const incomes = tree.filter((n) => n.category.type === "income");

  const askDelete = (c: Category) => {
    const childCount = cats.filter((x) => x.parentId === c.id).length;
    const msg = childCount > 0
      ? `حذف دسته «${c.name}»؟ ${childCount} زیرشاخه آن هم حذف می‌شود و تراکنش‌هایشان بدون دسته می‌شوند.`
      : `حذف دسته «${c.name}»؟ تراکنش‌های مرتبط بدون دسته می‌شوند.`;
    if (confirm(msg)) deleteMutation.mutate(c.id);
  };

  const renderGroup = (title: string, nodes: CategoryNode[], tone: string) => (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className={`flex items-center gap-2 text-base ${tone}`}>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {nodes.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">دسته‌ای وجود ندارد</p>
        ) : (
          nodes.map((n) => (
            <CategoryRow
              key={n.category.id}
              node={n}
              all={cats}
              onEdit={(c) => setEditing(c)}
              onAddChild={(c) => setAddingChildOf(c)}
              onDelete={askDelete}
            />
          ))
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button onClick={() => setAddOpen(true)} className="bg-emerald-700 hover:bg-emerald-800">
          <Plus className="ml-1 h-4 w-4" /> دسته جدید
        </Button>
        <Badge variant="secondary" className="text-xs">
          {cats.length} دسته
        </Badge>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>
      ) : (
        <>
          {renderGroup("دسته‌های هزینه", expenses, "text-red-600")}
          {renderGroup("دسته‌های درآمد", incomes, "text-emerald-700")}
        </>
      )}

      <Card>
        <CardContent className="flex items-start gap-2 p-4 text-xs leading-5 text-muted-foreground">
          <ListTree className="mt-0.5 h-4 w-4 shrink-0" />
          هر دسته می‌تواند تا ۳ زیرشاخه داشته باشد — دکمه ↵ روی هر دسته زیرشاخه می‌سازد (فقط وقتی «زیرشاخه فعال» باشد).
          دسته‌بندی کردن هزینه‌ها در داشبورد نشان می‌دهد پول شما کجا می‌رود.
        </CardContent>
      </Card>

      {addOpen && <CategoryDialog open={addOpen} onOpenChange={setAddOpen} allCount={cats} />}
      {addingChildOf && (
        <CategoryDialog
          open={!!addingChildOf}
          onOpenChange={(v) => !v && setAddingChildOf(null)}
          parent={addingChildOf}
          allCount={cats}
        />
      )}
      {editing && (
        <CategoryDialog
          open={!!editing}
          onOpenChange={(v) => !v && setEditing(null)}
          editing={editing}
          allCount={cats}
        />
      )}
    </div>
  );
}
