"use client";

import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Camera,
  Phone,
  HandCoins,
  CheckCircle2,
  ImagePlus,
  X,
} from "lucide-react";
import { api, compressImage, type Debt, type Attachment } from "@/lib/client-api";
import { formatMoney, parseMoneyInput, formatMoneyPlain, formatDateFa } from "@/lib/format";

type DebtFormState = {
  name: string;
  type: "debtor" | "creditor";
  amount: string;
  phone: string;
  description: string;
  dueDate: string;
};

const emptyForm: DebtFormState = {
  name: "",
  type: "debtor",
  amount: "",
  phone: "",
  description: "",
  dueDate: "",
};

function DebtDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing?: Debt | null;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<DebtFormState>({
    name: editing?.name || "",
    type: editing?.type || "debtor",
    amount: editing ? formatMoneyPlain(editing.amount) : "",
    phone: editing?.phone || "",
    description: editing?.description || "",
    dueDate: editing?.dueDate ? editing.dueDate.slice(0, 10) : "",
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name,
        type: form.type,
        amount: parseMoneyInput(form.amount),
        phone: form.phone || null,
        description: form.description || null,
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
      };
      if (editing) return api.put(`/api/debts/${editing.id}`, body);
      return api.post("/api/debts", body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["debts"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      toast({ title: editing ? "بدهی ویرایش شد" : "بدهی ثبت شد" });
      onOpenChange(false);
    },
    onError: (e: Error) => toast({ title: "خطا", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>{editing ? "ویرایش بدهی" : "ثبت بدهی جدید"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setForm({ ...form, type: "debtor" })}
              className={`rounded-xl border-2 p-3 text-sm font-medium transition ${
                form.type === "debtor" ? "border-amber-500 bg-amber-50 text-amber-800" : "border-border text-muted-foreground"
              }`}
            >
              بدهکار <span className="block text-[10px] opacity-70">به من بدهکار است (طلب من)</span>
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, type: "creditor" })}
              className={`rounded-xl border-2 p-3 text-sm font-medium transition ${
                form.type === "creditor" ? "border-orange-500 bg-orange-50 text-orange-800" : "border-border text-muted-foreground"
              }`}
            >
              طلبکار <span className="block text-[10px] opacity-70">من بدهکار او هستم (بدهی من)</span>
            </button>
          </div>
          <div className="grid gap-2">
            <Label>نام شخص</Label>
            <Input
              placeholder="مثلاً: علی محمدی"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label>مبلغ کل (تومان)</Label>
            <Input
              inputMode="numeric"
              dir="ltr"
              className="text-left font-bold tabular-nums-persian"
              value={form.amount ? formatMoneyPlain(parseMoneyInput(form.amount)) : ""}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>شماره تماس (اختیاری)</Label>
              <Input
                dir="ltr"
                className="text-left"
                placeholder="0912..."
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>موعد تسویه (اختیاری)</Label>
              <Input
                type="date"
                className="tabular-nums-persian"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>توضیحات (اختیاری)</Label>
            <Textarea
              placeholder="مثلاً: قرض خرید لپ‌تاپ"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            انصراف
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !form.name.trim() || parseMoneyInput(form.amount) <= 0}
            className="bg-emerald-700 hover:bg-emerald-800"
          >
            {mutation.isPending ? "..." : editing ? "ذخیره تغییرات" : "ثبت"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaymentDialog({ debt, open, onOpenChange }: { debt: Debt; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const remaining = debt.amount - debt.paidAmount;

  const mutation = useMutation({
    mutationFn: () => api.put(`/api/debts/${debt.id}`, { addPayment: parseMoneyInput(amount) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["debts"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      toast({ title: "پرداخت ثبت شد" });
      setAmount("");
      onOpenChange(false);
    },
    onError: (e: Error) => toast({ title: "خطا", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle>ثبت پرداخت از {debt.name}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          مانده بدهی: <span className="font-bold text-foreground tabular-nums-persian">{formatMoney(remaining)}</span> تومان
        </p>
        <Input
          inputMode="numeric"
          dir="ltr"
          className="text-left font-bold tabular-nums-persian"
          placeholder={formatMoneyPlain(remaining)}
          value={amount ? formatMoneyPlain(parseMoneyInput(amount)) : ""}
          onChange={(e) => setAmount(e.target.value)}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            انصراف
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || parseMoneyInput(amount) <= 0}
            className="bg-emerald-700 hover:bg-emerald-800"
          >
            ثبت پرداخت
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DebtCard({ debt }: { debt: Debt }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [viewImg, setViewImg] = useState<Attachment | null>(null);
  const [uploading, setUploading] = useState(false);

  const remaining = Math.max(0, debt.amount - debt.paidAmount);
  const pct = debt.amount > 0 ? Math.min(100, (debt.paidAmount / debt.amount) * 100) : 0;
  const isDebtor = debt.type === "debtor";

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["debts"] });
    qc.invalidateQueries({ queryKey: ["stats"] });
  };

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const compressed = await compressImage(file);
      return api.post(`/api/debts/${debt.id}/attachments`, compressed);
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "عکس رسید اضافه شد" });
    },
    onError: (e: Error) => toast({ title: "خطا", description: e.message, variant: "destructive" }),
    onSettled: () => setUploading(false),
  });

  const deleteAttMutation = useMutation({
    mutationFn: (id: string) => api.del(`/api/attachments/${id}`),
    onSuccess: () => {
      invalidate();
      toast({ title: "عکس حذف شد" });
    },
  });

  const settleMutation = useMutation({
    mutationFn: (settled: boolean) => api.put(`/api/debts/${debt.id}`, { isSettled: settled }),
    onSuccess: () => {
      invalidate();
      toast({ title: "وضعیت به‌روزرسانی شد" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.del(`/api/debts/${debt.id}`),
    onSuccess: () => {
      invalidate();
      toast({ title: "بدهی حذف شد" });
    },
  });

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploading(true);
      uploadMutation.mutate(file);
    }
    e.target.value = "";
  };

  return (
    <Card className="py-0 overflow-hidden">
      <div
        className={`h-1.5 w-full ${isDebtor ? "bg-amber-400" : "bg-orange-400"}`}
      />
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-11 w-11 items-center justify-center rounded-full font-bold text-lg ${
                isDebtor ? "bg-amber-100 text-amber-800" : "bg-orange-100 text-orange-800"
              }`}
            >
              {debt.name.trim().charAt(0) || "؟"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold">{debt.name}</span>
                <Badge className={isDebtor ? "bg-amber-100 text-amber-800 hover:bg-amber-100" : "bg-orange-100 text-orange-800 hover:bg-orange-100"}>
                  {isDebtor ? "بدهکار (طلب من)" : "طلبکار (بدهی من)"}
                </Badge>
                {debt.isSettled && (
                  <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                    <CheckCircle2 className="ml-1 h-3 w-3" /> تسویه شد
                  </Badge>
                )}
              </div>
              <div className="mt-0.5 text-sm text-muted-foreground tabular-nums-persian">
                کل: {formatMoney(debt.amount)} تومان
                {debt.paidAmount > 0 && <span className="mr-2">| پرداخت‌شده: {formatMoney(debt.paidAmount)}</span>}
              </div>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditOpen(true)}>
                <Pencil className="ml-2 h-4 w-4" /> ویرایش
              </DropdownMenuItem>
              {!debt.isSettled && (
                <DropdownMenuItem onClick={() => settleMutation.mutate(true)}>
                  <CheckCircle2 className="ml-2 h-4 w-4" /> تسویه کامل
                </DropdownMenuItem>
              )}
              {debt.isSettled && (
                <DropdownMenuItem onClick={() => settleMutation.mutate(false)}>
                  <X className="ml-2 h-4 w-4" /> لغو تسویه
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                className="text-red-600"
                onClick={() => {
                  if (confirm(`حذف بدهی ${debt.name}؟`)) deleteMutation.mutate();
                }}
              >
                <Trash2 className="ml-2 h-4 w-4" /> حذف
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {!debt.isSettled && (
          <div className="mt-3 space-y-1.5">
            <Progress value={pct} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                مانده: <span className={`font-bold tabular-nums-persian ${isDebtor ? "text-amber-700" : "text-orange-700"}`}>{formatMoney(remaining)}</span> تومان
              </span>
              <span>{Math.round(pct)}٪ پرداخت‌شده</span>
            </div>
          </div>
        )}

        {debt.description && <p className="mt-2 text-sm text-muted-foreground">{debt.description}</p>}
        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {debt.phone && (
            <a href={`tel:${debt.phone}`} className="flex items-center gap-1 hover:text-emerald-700">
              <Phone className="h-3 w-3" /> <span dir="ltr">{debt.phone}</span>
            </a>
          )}
          {debt.dueDate && <span>موعد: {formatDateFa(debt.dueDate)}</span>}
        </div>

        {/* عکس‌های رسید */}
        {debt.attachments.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {debt.attachments.map((att) => (
              <button
                key={att.id}
                onClick={() => setViewImg(att)}
                className="group relative h-16 w-16 overflow-hidden rounded-lg border transition hover:ring-2 hover:ring-emerald-500"
              >
                <img src={`/api/attachments/${att.id}`} alt={att.fileName} className="h-full w-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center gap-2">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="h-8 text-xs"
          >
            <ImagePlus className="ml-1 h-3.5 w-3.5" />
            {uploading ? "در حال آپلود..." : "افزودن عکس رسید"}
          </Button>
          {!debt.isSettled && (
            <Button variant="outline" size="sm" onClick={() => setPayOpen(true)} className="h-8 text-xs">
              <HandCoins className="ml-1 h-3.5 w-3.5" /> ثبت پرداخت
            </Button>
          )}
          {debt.attachments.length > 0 && (
            <span className="mr-auto flex items-center gap-1 text-xs text-muted-foreground">
              <Camera className="h-3 w-3" /> {debt.attachments.length} عکس
            </span>
          )}
        </div>
      </CardContent>

      {/* مشاهده عکس */}
      <Dialog open={!!viewImg} onOpenChange={(v) => !v && setViewImg(null)}>
        <DialogContent className="sm:max-w-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm">رسید - {debt.name}</DialogTitle>
          </DialogHeader>
          {viewImg && (
            <div className="relative">
              <img src={`/api/attachments/${viewImg.id}`} alt={viewImg.fileName} className="max-h-[65vh] w-full rounded-lg object-contain" />
              <Button
                variant="destructive"
                size="sm"
                className="mt-3"
                onClick={() => {
                  if (confirm("این عکس حذف شود؟")) {
                    deleteAttMutation.mutate(viewImg.id);
                    setViewImg(null);
                  }
                }}
              >
                <Trash2 className="ml-1 h-3.5 w-3.5" /> حذف عکس
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <PaymentDialog debt={debt} open={payOpen} onOpenChange={setPayOpen} />
      <DebtDialogWrapper debt={debt} open={editOpen} onOpenChange={setEditOpen} />
    </Card>
  );
}

// wrapper برای جلوگیری از مشکل state در dialog ویرایش
function DebtDialogWrapper({ debt, open, onOpenChange }: { debt: Debt; open: boolean; onOpenChange: (v: boolean) => void }) {
  if (!open) return null;
  return <DebtDialog open={open} onOpenChange={onOpenChange} editing={debt} />;
}

export function Debts() {
  const [filter, setFilter] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const params = new URLSearchParams();
  if (filter === "debtor" || filter === "creditor") params.set("type", filter);
  if (filter === "settled") params.set("status", "settled");
  if (filter === "open") params.set("status", "open");

  const { data, isLoading } = useQuery<Debt[]>({
    queryKey: ["debts", filter],
    queryFn: () => api.get(`/api/debts?${params.toString()}`),
  });

  const seedMutation = useMutation({
    mutationFn: () =>
      api.post("/api/categories", { name: "دسته نمونه", type: "expense" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });
  void seedMutation;

  const filters = [
    { v: "all", label: "همه" },
    { v: "open", label: "فعال" },
    { v: "debtor", label: "بدهکاران" },
    { v: "creditor", label: "طلبکاران" },
    { v: "settled", label: "تسویه‌شده" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setAddOpen(true)} className="bg-emerald-700 hover:bg-emerald-800">
          <Plus className="ml-1 h-4 w-4" /> بدهی جدید
        </Button>
        <div className="flex flex-wrap rounded-lg border p-1">
          {filters.map((o) => (
            <button
              key={o.v}
              onClick={() => setFilter(o.v)}
              className={`rounded-md px-3 py-1 text-xs transition ${
                filter === o.v ? "bg-emerald-700 text-white" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <HandCoins className="h-10 w-10 text-muted-foreground/40" />
            <p className="font-medium">بدهی‌ای ثبت نشده</p>
            <p className="text-sm text-muted-foreground">بدهکاران و طلبکاران خود را با عکس رسید ثبت کنید</p>
            <Button onClick={() => setAddOpen(true)} className="mt-2 bg-emerald-700 hover:bg-emerald-800">
              <Plus className="ml-1 h-4 w-4" /> ثبت بدهی
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {data.map((d) => (
            <DebtCard key={d.id} debt={d} />
          ))}
        </div>
      )}

      {addOpen && <DebtDialog open={addOpen} onOpenChange={setAddOpen} />}
      <ToastPortalHelper />
    </div>
  );
}

function ToastPortalHelper() {
  // برای سازگاری رندر سمت کلاینت
  return null;
}
