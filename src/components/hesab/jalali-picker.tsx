"use client";
// انتخابگر تاریخ/ساعت جلالی مشترک (تراکنش‌ها + اقساط و چک‌ها)
// سال ← ماه ← روز ← ساعت (ترتیب درست برای کاربر ایرانی)
// تاریخ دقیق (با ساعت) ذخیره می‌شود تا ترتیب تراکنش‌ها درست باشد

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  dateToJalaliParts,
  jalaliPartsToIso,
  jalaliMonthLength,
  JALALI_MONTH_NAMES,
} from "@/lib/jalali";

export function JalaliDateTimePicker({
  value,
  onChange,
  showTime = true,
}: {
  value: string;
  onChange: (iso: string) => void;
  showTime?: boolean;
}) {
  const parts = dateToJalaliParts(new Date(value));
  const [jy, setJy] = useState(parts.jy);
  const [jm, setJm] = useState(parts.jm);
  const [jd, setJd] = useState(parts.jd);
  const [hhmm, setHhmm] = useState(
    () => `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`
  );

  const dayLen = jalaliMonthLength(jy, jm);
  const effDay = Math.min(jd, dayLen);
  const [h, m] = hhmm.split(":").map((x) => Number(x) || 0);

  const emit = (ny: number, nm: number, nd: number) => {
    onChange(jalaliPartsToIso(ny, nm, Math.min(nd, jalaliMonthLength(ny, nm)), h, m));
  };

  const years: number[] = [];
  for (let y = parts.jy + 5; y >= parts.jy - 20; y--) years.push(y);

  const selectCls = "h-9 text-xs";

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <div className="grid gap-1">
          <Label className="text-[11px] text-muted-foreground">سال</Label>
          <Select value={String(jy)} onValueChange={(v) => { setJy(Number(v)); emit(Number(v), jm, effDay); }}>
            <SelectTrigger className={selectCls}><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-56">
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>{y.toLocaleString("fa-IR", { useGrouping: false })}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1">
          <Label className="text-[11px] text-muted-foreground">ماه</Label>
          <Select value={String(jm)} onValueChange={(v) => { setJm(Number(v)); emit(jy, Number(v), effDay); }}>
            <SelectTrigger className={selectCls}><SelectValue /></SelectTrigger>
            <SelectContent>
              {JALALI_MONTH_NAMES.map((name, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1">
          <Label className="text-[11px] text-muted-foreground">روز</Label>
          <Select value={String(effDay)} onValueChange={(v) => { setJd(Number(v)); emit(jy, jm, Number(v)); }}>
            <SelectTrigger className={selectCls}><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-56">
              {Array.from({ length: dayLen }, (_, i) => i + 1).map((d) => (
                <SelectItem key={d} value={String(d)}>{d.toLocaleString("fa-IR", { useGrouping: false })}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {showTime && (
        <div className="grid gap-1">
          <Label className="text-[11px] text-muted-foreground">ساعت</Label>
          <Input
            type="time"
            dir="ltr"
            className="text-left"
            value={hhmm}
            onChange={(e) => {
              setHhmm(e.target.value);
              const [nh, nm2] = e.target.value.split(":").map((x) => Number(x) || 0);
              onChange(jalaliPartsToIso(jy, jm, effDay, nh, nm2));
            }}
          />
        </div>
      )}
    </div>
  );
}
