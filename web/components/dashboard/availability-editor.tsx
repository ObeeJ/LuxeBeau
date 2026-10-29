"use client";

import { useMemo, useState } from "react";
import { Loader2, Plus, X } from "@/components/icons";
import { Panel } from "@/components/dashboard/widgets";
import { EmptyState, FieldError, LoadError } from "@/components/site/states";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAddSlot, useMySchedule, useMySlots, useRemoveSlot, useSaveSchedule } from "@/lib/queries";
import { type DayHours, type Slot } from "@/lib/api";
import { getFriendlyErrorMessage } from "@/lib/errors";
import { lagosToday } from "@/lib/format";
import { cn } from "@/lib/utils";

/* Week starts Monday for display; values follow the API (0 = Sunday). */
const WEEK = [
  { day: 1, label: "Monday" },
  { day: 2, label: "Tuesday" },
  { day: 3, label: "Wednesday" },
  { day: 4, label: "Thursday" },
  { day: 5, label: "Friday" },
  { day: 6, label: "Saturday" },
  { day: 0, label: "Sunday" },
];
const SLOT_LENGTHS = [15, 30, 45, 60, 90, 120];
/* Notice choices mirror api-go domain.CancelWindowChoices. */
const NOTICE_CHOICES: [number, string][] = [
  [0, "Free to cancel any time"],
  [12, "12 hours"],
  [24, "24 hours"],
  [48, "48 hours"],
  [72, "72 hours"],
];
const CLOCK = Array.from({ length: 38 }, (_, i) => {
  const mins = 5 * 60 + i * 30; // 05:00 to 23:30
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
});

const dateFmt = new Intl.DateTimeFormat("en-NG", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const formatDate = (iso: string) => dateFmt.format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));

function to12h(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

type Week = Record<number, { open: boolean; start: string; end: string }>;

function toWeek(hours: DayHours[]): Week {
  const w: Week = {};
  for (const { day } of WEEK) w[day] = { open: false, start: "09:00", end: "18:00" };
  for (const h of hours) w[h.weekday] = { open: true, start: h.start, end: h.end };
  return w;
}

function HoursForm({ initial }: { initial: { weeklyHours: DayHours[]; slotMinutes: number; daysOff: string[]; cancelWindowHours: number } }) {
  const [week, setWeek] = useState<Week>(() => toWeek(initial.weeklyHours));
  const [slotMinutes, setSlotMinutes] = useState(initial.slotMinutes);
  const [daysOff, setDaysOff] = useState<string[]>(initial.daysOff);
  const [notice, setNotice] = useState(initial.cancelWindowHours);
  const [newOff, setNewOff] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const save = useSaveSchedule();
  const today = lagosToday();

  const setDay = (day: number, patch: Partial<Week[number]>) => {
    setSaved(false);
    setWeek(w => ({ ...w, [day]: { ...w[day], ...patch } }));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const open = WEEK.filter(({ day }) => week[day].open);
    const bad = open.find(({ day }) => week[day].end <= week[day].start);
    if (bad) return setError(`${bad.label} must close after it opens.`);
    setError("");
    const hours: DayHours[] = open.map(({ day }) => ({ weekday: day, start: week[day].start, end: week[day].end }));
    save.mutate(
      { weeklyHours: hours, slotMinutes, daysOff, cancelWindowHours: notice },
      { onSuccess: () => setSaved(true), onError: err => setError(getFriendlyErrorMessage(err, "We couldn't save your hours.")) },
    );
  };

  const addOff = () => {
    if (!newOff || newOff < today || daysOff.includes(newOff)) return;
    setSaved(false);
    setDaysOff(d => [...d, newOff].sort());
    setNewOff("");
  };

  return (
    <form onSubmit={submit} noValidate>
      <ul className="divide-y divide-hairline">
        {WEEK.map(({ day, label }) => {
          const d = week[day];
          return (
            <li key={day} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 first:pt-0">
              <label className="flex w-36 cursor-pointer items-center gap-2.5 text-[16px] tracking-[-0.031em]">
                <input type="checkbox" checked={d.open} onChange={e => setDay(day, { open: e.target.checked })} className="h-4 w-4 accent-[#2a0b48]" />
                {label}
              </label>
              {d.open ? (
                <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
                  <select aria-label={`${label} opens`} value={d.start} onChange={e => setDay(day, { start: e.target.value })} className="lb-input h-10 min-w-0 flex-1 sm:w-36 sm:flex-none">
                    {CLOCK.map(t => <option key={t} value={t}>{to12h(t)}</option>)}
                  </select>
                  <span className="text-muted" aria-hidden>to</span>
                  <select aria-label={`${label} closes`} value={d.end} onChange={e => setDay(day, { end: e.target.value })} className="lb-input h-10 min-w-0 flex-1 sm:w-36 sm:flex-none">
                    {CLOCK.map(t => <option key={t} value={t}>{to12h(t)}</option>)}
                  </select>
                </div>
              ) : (
                <span className="text-[14px] tracking-[-0.014em] text-muted">Closed</span>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="slot-length">Booking slots every</Label>
          <select id="slot-length" value={slotMinutes} onChange={e => { setSaved(false); setSlotMinutes(Number(e.target.value)); }} className="lb-input mt-1.5 h-11 w-full">
            {SLOT_LENGTHS.map(m => <option key={m} value={m}>{m < 60 ? `${m} minutes` : m === 60 ? "1 hour" : `${m / 60} hours`}</option>)}
          </select>
          <p className="mt-1.5 text-[12px] tracking-[-0.017em] text-muted">Longer services take several slots in a row.</p>
        </div>
        <div>
          <Label htmlFor="day-off">Days off</Label>
          <div className="mt-1.5 flex gap-2">
            <Input id="day-off" type="date" min={today} value={newOff} onChange={e => setNewOff(e.target.value)} />
            <Button type="button" variant="outline" onClick={addOff} disabled={!newOff}>Add</Button>
          </div>
          {daysOff.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Days off">
              {daysOff.map(d => (
                <li key={d} className="inline-flex h-8 items-center gap-1 rounded-full bg-canvas pl-3 pr-1 text-[14px] tracking-[-0.014em]">
                  {formatDate(d)}
                  <button type="button" aria-label={`Remove ${formatDate(d)}`} onClick={() => { setSaved(false); setDaysOff(x => x.filter(y => y !== d)); }} className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-surface">
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-5 max-w-sm">
        <Label htmlFor="cancel-notice">Notice for free cancellation</Label>
        <select id="cancel-notice" value={notice} onChange={e => { setSaved(false); setNotice(Number(e.target.value)); }} className="lb-input mt-1.5 h-11 w-full">
          {NOTICE_CHOICES.map(([h, label]) => <option key={h} value={h}>{label}</option>)}
        </select>
        <p className="mt-1.5 text-[12px] tracking-[-0.017em] text-muted">
          Clients see this before they book. If they cancel a confirmed booking later than this it is marked as a late cancellation on their record, which you can see. Most salons use 24 to 48 hours. Nothing is charged online.
        </p>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending && <Loader2 className="animate-spin" aria-hidden />}
          Save hours
        </Button>
        {saved && <span className="text-[14px] tracking-[-0.014em] text-muted" role="status">Saved. Open times are updated.</span>}
      </div>
      <FieldError>{error}</FieldError>
      <p className="mt-3 text-[12px] tracking-[-0.017em] text-muted">Existing bookings stay where they are when you change your hours.</p>
    </form>
  );
}

function UpcomingSlots() {
  const slots = useMySlots(true, 14);
  const add = useAddSlot();
  const remove = useRemoveSlot();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [error, setError] = useState("");
  const today = lagosToday();

  const byDate = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots.data ?? []) {
      const key = s.slot_date.slice(0, 10);
      map.set(key, [...(map.get(key) ?? []), s]);
    }
    return [...map.entries()];
  }, [slots.data]);

  const addSlot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !/^\d{2}:\d{2}$/.test(time)) return setError("Choose a date and a time.");
    setError("");
    add.mutate({ date, time }, { onSuccess: () => setTime(""), onError: err => setError(getFriendlyErrorMessage(err, "We couldn't open that time.")) });
  };

  return (
    <Panel title="Next two weeks">
      <form onSubmit={addSlot} noValidate className="flex flex-wrap items-end gap-2">
        <div>
          <Label htmlFor="extra-date">Open an extra time</Label>
          <Input id="extra-date" type="date" min={today} value={date} onChange={e => setDate(e.target.value)} className="mt-1.5 w-44" />
        </div>
        <div>
          <Label htmlFor="extra-time" className="sr-only">Time</Label>
          <Input id="extra-time" type="time" step={900} value={time} onChange={e => setTime(e.target.value)} className="w-32" />
        </div>
        <Button type="submit" variant="outline" disabled={add.isPending}>
          {add.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />} Open
        </Button>
      </form>
      <FieldError>{error}</FieldError>

      <div className="mt-5">
        {slots.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : slots.isError ? (
          <LoadError onRetry={() => slots.refetch()} message="We couldn't load your times." />
        ) : byDate.length === 0 ? (
          <EmptyState>No open times yet. Set your weekly hours above, or open an extra time.</EmptyState>
        ) : (
          <ul className="divide-y divide-hairline">
            {byDate.map(([d, list]) => (
              <li key={d} className="flex flex-col gap-2 py-3 first:pt-0 sm:flex-row sm:items-start sm:gap-4">
                <span className="w-28 shrink-0 text-[14px] tracking-[-0.014em]">{formatDate(d)}</span>
                <div className="flex flex-wrap gap-1.5">
                  {list.map(s =>
                    s.reserved ? (
                      <span key={s.id} className="inline-flex h-8 items-center rounded-full bg-ink px-3 text-[12px] tracking-[-0.017em] text-surface" title="Booked">
                        {to12h(s.slot_time)} · Booked
                      </span>
                    ) : (
                      <span key={s.id} className={cn("inline-flex h-8 items-center gap-0.5 rounded-full border border-hairline pl-3 pr-1 text-[12px] tracking-[-0.017em]", s.source === "manual" && "border-ink")}>
                        {to12h(s.slot_time)}
                        <button
                          type="button"
                          aria-label={`Close ${to12h(s.slot_time)} on ${formatDate(d)}`}
                          disabled={remove.isPending}
                          onClick={() => remove.mutate(s.id, { onError: err => setError(getFriendlyErrorMessage(err, "We couldn't close that time.")) })}
                          className="flex h-6 w-6 items-center justify-center rounded-full text-muted hover:bg-canvas hover:text-ink"
                        >
                          <X className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </span>
                    ),
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="mt-4 text-[12px] tracking-[-0.017em] text-muted">
        Closing a time hides it from clients. Extra times you open have a dark outline. Changing weekly hours resets times you closed by hand.
      </p>
    </Panel>
  );
}

/* Weekly opening hours, days off and one-off times. */
export function AvailabilityEditor() {
  const schedule = useMySchedule(true);
  return (
    <div className="space-y-5">
      <Panel title="Weekly hours">
        {schedule.isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : schedule.isError || !schedule.data ? (
          <LoadError onRetry={() => schedule.refetch()} message="We couldn't load your hours." />
        ) : (
          <HoursForm initial={schedule.data} />
        )}
      </Panel>
      <UpcomingSlots />
    </div>
  );
}
