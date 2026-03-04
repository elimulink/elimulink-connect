import React, { useMemo } from "react";

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function dayKey(d) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function countForDay(items, day) {
  const s = startOfDay(day).getTime();
  const e = new Date(day);
  e.setHours(23, 59, 59, 999);
  const ee = e.getTime();

  let c = 0;
  for (const it of items) {
    const a = new Date(it.start_at).getTime();
    const b = new Date(it.end_at).getTime();
    if (!(b < s || a > ee)) c++;
  }
  return c;
}

export default function MonthGrid({ month, items, selectedDay, onSelectDay }) {
  const range = useMemo(() => MonthGrid.getGridRange(month), [month]);

  const days = useMemo(() => {
    const list = [];
    let cur = new Date(range.from);
    while (cur <= range.to) {
      list.push(new Date(cur));
      cur = addDays(cur, 1);
    }
    return list;
  }, [range]);

  return (
    <div>
      <div className="grid grid-cols-7 text-[12px] text-slate-500 px-2 pt-3">
        {["S", "S", "M", "T", "W", "T", "F"].map((d, i) => (
          <div key={i} className="py-2 text-center tracking-[0.18em]">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-[6px] px-2 pb-3">
        {days.map((d) => {
          const inMonth = d.getMonth() === month.getMonth();
          const isSel = selectedDay && sameDay(d, selectedDay);
          const c = countForDay(items, d);

          return (
            <button
              key={dayKey(d)}
              onClick={() => onSelectDay?.(startOfDay(d))}
              className={
                "h-12 sm:h-[54px] rounded-full relative grid place-items-center transition " +
                (isSel ? "bg-[#DDE9DD] text-slate-900" : "hover:bg-black/5") +
                (inMonth ? "" : " text-slate-400")
              }
              aria-label={`Day ${d.getDate()}`}
            >
              <span className={"text-[15px] " + (isSel ? "font-semibold" : "font-medium")}>
                {d.getDate()}
              </span>

              {c > 0 && (
                <span className="absolute bottom-[8px] w-[6px] h-[6px] rounded-full bg-[#2F6B58]" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

MonthGrid.getGridRange = function getGridRange(month) {
  const first = new Date(month);
  first.setDate(1);
  first.setHours(0, 0, 0, 0);

  const from = new Date(first);
  const day = from.getDay();
  from.setDate(from.getDate() - day);

  const last = new Date(month);
  last.setMonth(last.getMonth() + 1);
  last.setDate(0);
  last.setHours(23, 59, 59, 999);

  const to = new Date(last);
  const endDay = to.getDay();
  to.setDate(to.getDate() + (6 - endDay));
  to.setHours(23, 59, 59, 999);

  return { from, to };
};