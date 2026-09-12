"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AttendanceRosterDateBarProps {
  date: string;
}

/** The roster page's date selector — the selected date lives in the URL
 * (`?date=`) so a reload/share/back-navigation preserves it, mirroring
 * employee-filter-bar.tsx's URL-state convention. */
export function AttendanceRosterDateBar({ date }: AttendanceRosterDateBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(nextDate: string) {
    if (!nextDate) {
      return;
    }
    const params = new URLSearchParams(searchParams);
    params.set("date", nextDate);
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="roster-date">Date</Label>
      <Input
        id="roster-date"
        type="date"
        value={date}
        onChange={(event) => handleChange(event.target.value)}
        className="w-full sm:w-48"
      />
    </div>
  );
}
