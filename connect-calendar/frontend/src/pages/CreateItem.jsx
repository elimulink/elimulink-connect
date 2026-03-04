import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiGet, apiPost } from "../lib/api.js";

const KIND_LABELS = [
  { key: "EVENT", label: "Event" },
  { key: "TASK", label: "Task" },
  { key: "WORKING_LOCATION", label: "Working location" },
  { key: "OUT_OF_OFFICE", label: "Out of office" },
];

function isoLocalToDate(s) {
  // s like 2026-03-04T10:30
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export default function CreateItem() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const initialKind = sp.get("kind") || "EVENT";

  const [calendars, setCalendars] = useState([]);
  const [calendarId, setCalendarId] = useState("");
  const [kind, setKind] = useState(initialKind);

  const [title, setTitle] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [locationText, setLocationText] = useState("");
  const [autoDecline, setAutoDecline] = useState(false);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      const data = await apiGet("/calendars");
      setCalendars(data || []);
      const primary = (data || []).find((c) => c.is_primary) || (data || [])[0];
      if (primary) setCalendarId(primary.id);
    })();
  }, []);

  const tz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", []);

  const showLocation = kind === "WORKING_LOCATION";
  const showAutoDecline = kind === "OUT_OF_OFFICE";

  return (
    <div className="min-h-screen bg-[#EEF3EE] px-4 py-6">
      <div className="max-w-xl mx-auto rounded-[28px] bg-white/60 backdrop-blur border border-black/5 shadow-[0_14px_60px_rgba(0,0,0,0.08)] p-5">
        <div className="flex items-center justify-between">
          <div className="text-[18px] font-semibold tracking-tight">Create</div>
          <button
            onClick={() => nav("/calendar")}
            className="w-10 h-10 rounded-2xl hover:bg-black/5 grid place-items-center"
            aria-label="Close"
          >
            ?
          </button>
        </div>

        {/* Kind chips */}
        <div className="mt-4 flex flex-wrap gap-2">
          {KIND_LABELS.map((k) => {
            const active = kind === k.key;
            return (
              <button
                key={k.key}
                onClick={() => setKind(k.key)}
                className={
                  "px-4 py-2 rounded-full border text-sm font-semibold transition " +
                  (active
                    ? "bg-[#DDE9DD] border-black/5 text-slate-900"
                    : "bg-white/45 border-black/5 text-slate-700 hover:bg-black/5")
                }
              >
                {k.label}
              </button>
            );
          })}
          <button
            disabled
            className="px-4 py-2 rounded-full border text-sm font-semibold bg-white/30 border-black/5 text-slate-400"
          >
            Birthday (disabled)
          </button>
        </div>

        {err ? (
          <div className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            {err}
          </div>
        ) : null}

        {/* Title */}
        <div className="mt-4">
          <label className="text-sm font-semibold text-slate-800">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add title"
            className="mt-2 w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 outline-none focus:ring-2 focus:ring-black/10"
          />
        </div>

        {/* Calendar select */}
        <div className="mt-4">
          <label className="text-sm font-semibold text-slate-800">Calendar</label>
          <select
            value={calendarId}
            onChange={(e) => setCalendarId(e.target.value)}
            className="mt-2 w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 outline-none focus:ring-2 focus:ring-black/10"
          >
            {calendars.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* All day */}
        <div className="mt-4 flex items-center justify-between rounded-2xl border border-black/5 bg-white/50 px-4 py-3">
          <div className="font-semibold text-slate-800">All-day</div>
          <button
            onClick={() => setAllDay((v) => !v)}
            className={
              "w-14 h-8 rounded-full border border-black/10 transition relative " +
              (allDay ? "bg-[#2F6B58]" : "bg-white/60")
            }
            aria-label="All day toggle"
          >
            <span
              className={
                "absolute top-1 w-6 h-6 rounded-full bg-white shadow transition " +
                (allDay ? "left-7" : "left-1")
              }
            />
          </button>
        </div>

        {/* Start / End */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-semibold text-slate-800">Start</label>
            <input
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 outline-none focus:ring-2 focus:ring-black/10"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-800">End</label>
            <input
              type="datetime-local"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 outline-none focus:ring-2 focus:ring-black/10"
            />
          </div>
        </div>

        {/* Repeat placeholder */}
        <div className="mt-4 rounded-2xl border border-black/5 bg-white/50 px-4 py-3 text-slate-600 text-sm">
          Does not repeat (placeholder)
        </div>

        {/* Location */}
        {showLocation ? (
          <div className="mt-4">
            <label className="text-sm font-semibold text-slate-800">Location</label>
            <input
              value={locationText}
              onChange={(e) => setLocationText(e.target.value)}
              placeholder="Choose a location"
              className="mt-2 w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 outline-none focus:ring-2 focus:ring-black/10"
            />
          </div>
        ) : null}

        {/* Auto decline */}
        {showAutoDecline ? (
          <div className="mt-4 flex items-center justify-between rounded-2xl border border-black/5 bg-white/50 px-4 py-3">
            <div>
              <div className="font-semibold text-slate-800">Automatically decline meetings</div>
              <div className="text-xs text-slate-600">Mock behavior for MVP</div>
            </div>
            <button
              onClick={() => setAutoDecline((v) => !v)}
              className={
                "w-14 h-8 rounded-full border border-black/10 transition relative " +
                (autoDecline ? "bg-[#2F6B58]" : "bg-white/60")
              }
              aria-label="Auto decline toggle"
            >
              <span
                className={
                  "absolute top-1 w-6 h-6 rounded-full bg-white shadow transition " +
                  (autoDecline ? "left-7" : "left-1")
                }
              />
            </button>
          </div>
        ) : null}

        {/* Save */}
        <button
          disabled={saving}
          onClick={async () => {
            setErr("");
            try {
              if (!calendarId) throw new Error("No calendar selected.");
              if (!title.trim()) throw new Error("Title is required.");
              const s = isoLocalToDate(startAt);
              const e = isoLocalToDate(endAt);
              if (!s || !e) throw new Error("Start and End are required.");

              setSaving(true);
              await apiPost("/items", {
                calendar_id: calendarId,
                kind,
                title: title.trim(),
                description: null,
                start_at: s.toISOString(),
                end_at: e.toISOString(),
                all_day: Boolean(allDay),
                timezone: tz,
                location_text: showLocation ? (locationText || null) : null,
                status: "CONFIRMED",
                metadata: showAutoDecline ? { auto_decline: autoDecline } : {},
              });

              nav("/calendar");
            } catch (e2) {
              setErr(String(e2.message || e2));
            } finally {
              setSaving(false);
            }
          }}
          className="mt-6 w-full rounded-2xl bg-[#2F6B58] text-white font-semibold py-3 shadow-sm hover:opacity-95 transition"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}