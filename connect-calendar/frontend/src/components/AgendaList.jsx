import React from "react";

function fmtTime(d) {
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export default function AgendaList({ day, items }) {
  const label = day?.toLocaleString(undefined, { weekday: "short" }) || "";
  const num = day?.getDate?.() || "";

  const sorted = [...(items || [])].sort(
    (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
  );

  return (
    <div className="flex gap-3">
      <div className="w-10 text-slate-700">
        <div className="text-[13px] font-semibold">{label}</div>
        <div className="text-[28px] leading-[30px] font-semibold">{num}</div>
      </div>

      <div className="flex-1">
        {sorted.length === 0 ? (
          <div className="text-slate-500 text-sm py-3">No items for this day.</div>
        ) : (
          <div className="space-y-2">
            {sorted.map((it) => {
              const s = new Date(it.start_at);
              const e = new Date(it.end_at);
              return (
                <div
                  key={it.id}
                  className="rounded-2xl border border-black/5 bg-white/55 px-3 py-3 flex items-center justify-between"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 truncate">
                      {it.title || "(Untitled)"}
                    </div>
                    <div className="text-xs text-slate-600">
                      {it.all_day ? "All day" : `${fmtTime(s)} – ${fmtTime(e)}`} • {it.kind}
                    </div>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-[#2F6B58]/60" />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}