"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Tag, Receipt, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { api, type Category } from "@/lib/client-api";

const COLORS = [
  "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899",
  "#84cc16", "#f97316", "#6366f1", "#14b8a6", "#eab308", "#64748b",
];

function CategoryDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing?: Category | null;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState(editing?.name || "");
  const [type, setType] = useState<"income" | "expense">(editing?.type || "expense");
  const [color, setColor] = useState(editing?.color || COLORS[0]);

  const mutation = useMutation({
    mutationFn: async () => {
      const body = { name, type, color };
      if (editing) return api.put(`/api/categories/${editing.id}`, body);
      return api.post("/api/categories", body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      toast({ title: editing ? "دسته ویرایش شد" : "دسته جدید ساخته شد" });
      onOpenChange(false);
    },
    onError: (e: Error) => toast({ title: "خطا", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle>{editing ? "ویرایش دسته‌بندی" : "دسته‌بندی جدید"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
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
            {mutation.isPending ? "..." : editing ? "ذخیره" : "ساخت دسته"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function Categories() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);

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

  const expenses = (data || []).filter((c) => c.type === "expense");
  const incomes = (data || []).filter((c) => c.type === "income");

  const renderGroup = (title: string, cats: Category[], icon: React.ReactNode, tone: string) => (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className={`flex items-center gap-2 text-base ${tone}`}>{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {cats.length === 0 ? (
          <p className="col-span-full py-4 text-center text-sm text-muted-foreground">دسته‌ای وجود ندارد</p>
        ) : (
          cats.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-xl border p-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${c.color}22`, color: c.color }}>
                  <Tag className="h-4 w-4" />
                </span>
                <div>
                  <div className="text-sm font-medium">{c.name}</div>
                  {c._count !== undefined && (
                    <div className="text-xs text-muted-foreground">{c._count.transactions} تراکنش</div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-0.5">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(c)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => {
                    if (confirm(`حذف دسته «${c.name}»؟ تراکنش‌های مرتبط بدون دسته می‌شوند.`)) deleteMutation.mutate(c.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                </Button>
              </div>
            </div>
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
          {(data || []).length} دسته
        </Badge>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>
      ) : (
        <>
          {renderGroup("دسته‌های هزینه", expenses, <ArrowDownCircle className="h-4 w-4" />, "text-red-600")}
          {renderGroup("دسته‌های درآمد", incomes, <ArrowUpCircle className="h-4 w-4" />, "text-emerald-700")}
        </>
      )}

      <Card>
        <CardContent className="flex items-start gap-2 p-4 text-xs leading-5 text-muted-foreground">
          <Receipt className="mt-0.5 h-4 w-4 shrink-0" />
          دسته‌بندی‌ها کاملاً قابل ویرایش و حذف هستند. با دسته‌بندی کردن هزینه‌ها، در داشبورد می‌توانید ببینید پول شما کجا می‌رود.
        </CardContent>
      </Card>

      {addOpen && <CategoryDialog open={addOpen} onOpenChange={setAddOpen} />}
      {editing && <CategoryDialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)} editing={editing} />}
    </div>
  );
}
