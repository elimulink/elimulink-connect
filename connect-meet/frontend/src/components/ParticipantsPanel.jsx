import React from "react";

function MicOffIcon({ className = "" }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M12 17a4 4 0 0 0 4-4V8a4 4 0 0 0-7.72-1.44" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M5 11.5a7 7 0 0 0 11.83 4.99M12 18.5V21M4.5 4.5l15 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CameraOffIcon({ className = "" }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="7" width="11" height="10" rx="2.4" stroke="currentColor" strokeWidth="1.8" />
      <path d="m15 10 5-3v10l-5-3" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M4.5 4.5 19.5 19.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function PersonRow({
  dark,
  person,
  roleLabel,
  statusLabel,
  actions = [],
}) {
  return (
    <div
      className={`rounded-[22px] border px-3 py-3 ${
        dark ? "border-white/10 bg-white/[0.04]" : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={`grid h-10 w-10 place-items-center rounded-full font-bold ${
              dark ? "bg-white/10 text-white" : "bg-[#EAF4EF] text-[#2F6F57]"
            }`}
          >
            {(person?.display_name || person?.uid || "U")[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className={`truncate text-sm font-semibold ${dark ? "text-white" : "text-slate-900"}`}>
              {person?.display_name || person?.uid || "Unknown"}
            </div>
            <div className={`mt-0.5 flex flex-wrap items-center gap-2 text-xs ${dark ? "text-white/55" : "text-slate-500"}`}>
              {roleLabel ? <span>{roleLabel}</span> : null}
              {statusLabel ? <span>{statusLabel}</span> : null}
              {person?.audio_enabled === false ? (
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${dark ? "bg-white/[0.08] text-white/72" : "bg-slate-100 text-slate-600"}`}>
                  <MicOffIcon />
                  Muted
                </span>
              ) : null}
              {person?.video_enabled === false ? (
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${dark ? "bg-white/[0.08] text-white/72" : "bg-slate-100 text-slate-600"}`}>
                  <CameraOffIcon />
                  Camera off
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {actions.length ? (
          <div className="flex items-center gap-2">
            {actions.map((action) => (
              <button
                key={action.label}
                type="button"
                className={
                  "rounded-full px-3 py-1.5 text-xs font-semibold " +
                  (action.tone === "danger"
                    ? dark
                      ? "bg-red-400/12 text-red-200"
                      : "bg-red-50 text-red-600"
                    : action.tone === "subtle"
                      ? dark
                        ? "border border-white/10 text-white/80"
                        : "border border-slate-200 text-slate-600"
                      : dark
                        ? "bg-emerald-400/12 text-emerald-200"
                        : "bg-emerald-50 text-emerald-700")
                }
                onClick={action.onClick}
              >
                {action.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function ParticipantsPanel({
  dark,
  members = [],
  pending = [],
  hostUid,
  hostSessionId,
  myUid,
  currentSessionId,
  raisedHandCount = 0,
  onAdmit,
  onAdmitAll,
  onRemove,
  onDeny,
  onLowerHand,
  onTransferHost,
  onToggleLock,
  onToggleMuteOnEntry,
  onToggleAllowUnmute,
  onMuteAll,
  security,
}) {
  const shell = dark ? "darkShell text-white" : "glass text-slate-900";
  const border = dark ? "border-white/10" : "border-slate-900/10";
  const isHost = myUid === hostUid;
  const admittedCount = members.length;
  const waitingCount = pending.length;

  return (
    <div className={`h-full overflow-hidden rounded-3xl ${shell}`}>
      <div className={`border-b px-4 py-4 ${border}`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-current/55">People</div>
            <div className="mt-1 text-lg font-semibold">Participants</div>
            {raisedHandCount > 0 ? (
              <div className={`mt-1 text-xs ${dark ? "text-sky-100/80" : "text-sky-700"}`}>
                {raisedHandCount} hand{raisedHandCount === 1 ? "" : "s"} raised
              </div>
            ) : null}
          </div>
          <div className={`rounded-full border px-3 py-1 text-xs font-semibold ${dark ? "border-white/10 text-white/70" : "border-slate-200 text-slate-500"}`}>
            {admittedCount} in meeting
          </div>
        </div>
      </div>

      <div className="h-[calc(100%-84px)] overflow-auto px-4 py-4">
        <div className="space-y-5">
          <section className={`rounded-[24px] border p-4 ${dark ? "border-white/10 bg-white/[0.03]" : "border-slate-200 bg-slate-50/70"}`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className={`text-xs font-semibold uppercase tracking-[0.16em] ${dark ? "text-white/50" : "text-slate-500"}`}>Waiting in lobby</div>
                <div className={`mt-1 text-sm ${dark ? "text-white/70" : "text-slate-500"}`}>
                  {waitingCount > 0 ? `${waitingCount} people need host admission.` : "No one is waiting right now."}
                </div>
              </div>
              {isHost && waitingCount > 1 ? (
                <button
                  type="button"
                  className={`rounded-full px-3 py-2 text-xs font-semibold ${dark ? "bg-emerald-400/12 text-emerald-200" : "bg-emerald-50 text-emerald-700"}`}
                  onClick={onAdmitAll}
                >
                  Admit all
                </button>
              ) : null}
            </div>

            <div className="mt-4 space-y-3">
              {pending.map((person) => (
                <PersonRow
                  key={person.session_id || person.uid}
                  dark={dark}
                  person={person}
                  roleLabel="Waiting"
                  statusLabel="Host admission required"
                  actions={
                    isHost
                      ? [
                          { label: "Deny", tone: "subtle", onClick: () => onDeny?.(person) },
                          { label: "Admit", tone: "default", onClick: () => onAdmit?.(person) },
                        ]
                      : []
                  }
                />
              ))}
            </div>
          </section>

          <section className={`rounded-[24px] border p-4 ${dark ? "border-white/10 bg-white/[0.03]" : "border-slate-200 bg-slate-50/70"}`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className={`text-xs font-semibold uppercase tracking-[0.16em] ${dark ? "text-white/50" : "text-slate-500"}`}>In meeting</div>
                <div className={`mt-1 text-sm ${dark ? "text-white/70" : "text-slate-500"}`}>Host and admitted participants currently in the room.</div>
              </div>
              <div className={`rounded-full border px-3 py-1 text-xs font-semibold ${dark ? "border-white/10 text-white/70" : "border-slate-200 text-slate-500"}`}>
                {admittedCount} live
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {members.map((person) => (
                <PersonRow
                  key={person.session_id || person.uid}
                  dark={dark}
                  person={person}
                  roleLabel={
                    person.session_id === hostSessionId
                      ? (person.session_id === currentSessionId ? "Host / You" : "Host")
                      : person.session_id === currentSessionId
                        ? "You"
                        : person.role === "guest"
                          ? "Guest"
                          : "Participant"
                  }
                  statusLabel={[
                    person.hand_raised ? "Hand raised" : "Live in room",
                    person.session_id === currentSessionId ? "Signed in as me" : null,
                  ].filter(Boolean).join(" • ")}
                  actions={
                    isHost && person.session_id !== currentSessionId
                      ? [
                          ...(person.hand_raised ? [{ label: "Lower hand", tone: "default", onClick: () => onLowerHand?.(person) }] : []),
                          { label: "Make host", tone: "subtle", onClick: () => onTransferHost?.(person) },
                          { label: "Remove", tone: "danger", onClick: () => onRemove?.(person) },
                        ]
                      : []
                  }
                />
              ))}
              {members.length === 0 ? (
                <div className={`rounded-2xl border border-dashed px-4 py-4 text-sm ${dark ? "border-white/10 text-white/50" : "border-slate-200 text-slate-500"}`}>
                  No one has joined the room yet.
                </div>
              ) : null}
            </div>
          </section>

          {isHost ? (
            <section className={`rounded-[24px] border p-4 ${dark ? "border-white/10 bg-white/[0.03]" : "border-slate-200 bg-white"}`}>
              <div className={`text-xs font-semibold uppercase tracking-[0.16em] ${dark ? "text-white/50" : "text-slate-500"}`}>Host controls</div>
              <div className={`mt-1 text-sm ${dark ? "text-white/70" : "text-slate-500"}`}>
                Meeting-wide controls stay room-scoped and reflect the current live security state.
              </div>
              <div className="mt-4 grid gap-2">
                <button type="button" className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold ${dark ? "border-white/10 bg-white/[0.04] text-white" : "border-slate-200 bg-slate-50 text-slate-700"}`} onClick={onAdmitAll}>
                  Admit everyone waiting
                </button>
                <button type="button" className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold ${dark ? "border-white/10 bg-white/[0.04] text-white" : "border-slate-200 bg-slate-50 text-slate-700"}`} onClick={onMuteAll}>
                  Mute all current participants
                </button>
                <button type="button" className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold ${security?.locked ? (dark ? "border-amber-300/20 bg-amber-300/10 text-amber-100" : "border-amber-200 bg-amber-50 text-amber-700") : dark ? "border-white/10 bg-white/[0.04] text-white" : "border-slate-200 bg-slate-50 text-slate-700"}`} onClick={onToggleLock}>
                  {security?.locked ? "Unlock meeting" : "Lock meeting"}
                </button>
                <button type="button" className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold ${security?.mute_on_entry ? (dark ? "border-sky-300/20 bg-sky-300/10 text-sky-100" : "border-sky-200 bg-sky-50 text-sky-700") : dark ? "border-white/10 bg-white/[0.04] text-white" : "border-slate-200 bg-slate-50 text-slate-700"}`} onClick={onToggleMuteOnEntry}>
                  {security?.mute_on_entry ? "Mute on entry is on" : "Mute on entry is off"}
                </button>
                <button type="button" className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold ${security?.allow_unmute ? (dark ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : "border-emerald-200 bg-emerald-50 text-emerald-700") : dark ? "border-white/10 bg-white/[0.04] text-white" : "border-slate-200 bg-slate-50 text-slate-700"}`} onClick={onToggleAllowUnmute}>
                  {security?.allow_unmute ? "Attendees can unmute" : "Attendees cannot unmute"}
                </button>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
