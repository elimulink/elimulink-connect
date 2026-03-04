import React from "react";

export default function ChatPanel({ dark, messages = [], onSend }) {
  const [text, setText] = React.useState("");

  const shell = dark ? "darkShell text-white" : "glass text-slate-900";
  const border = dark ? "border-white/10" : "border-slate-900/10";

  return (
    <div className={`h-full rounded-3xl ${shell} overflow-hidden`}>
      <div className={`px-4 py-4 flex items-center justify-between border-b ${border}`}>
        <div className="flex items-center gap-3">
          <button className={dark ? "iconBtnDark" : "iconBtn"} aria-label="menu">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M4 6h16M4 12h16M4 18h16" stroke={dark ? "rgba(255,255,255,.8)" : "rgba(15,23,42,.75)"} strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
          <div className="font-semibold">Chat</div>
        </div>
        <button className={dark ? "iconBtnDark" : "iconBtn"} aria-label="more">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M6 12h.01M12 12h.01M18 12h.01" stroke={dark ? "rgba(255,255,255,.8)" : "rgba(15,23,42,.75)"} strokeWidth="3" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      <div className="p-4 space-y-3 overflow-auto h-[calc(100%-140px)]">
        {messages.length === 0 ? (
          <div className={`text-sm ${dark ? "text-white/60" : "text-slate-600"}`}>No messages yet.</div>
        ) : (
          messages.map((m, idx) => {
            const name = m.name || m.display_name || m.from_uid || "User";
            const textValue = m.text || m.message || "";
            return (
              <div key={idx} className="flex items-start gap-3">
                <div className={`h-10 w-10 rounded-full grid place-items-center font-bold ${dark ? "bg-white/10 text-white" : "bg-[rgba(47,111,87,.18)] text-[rgba(47,111,87,.95)]"}`}>
                  {name[0]?.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className={`text-sm font-semibold ${dark ? "text-white" : "text-slate-900"}`}>{name}</div>
                  <div className={`text-sm ${dark ? "text-white/70" : "text-slate-600"} break-words`}>{textValue}</div>
                </div>
                <div className={`ml-auto text-xs ${dark ? "text-white/40" : "text-slate-400"}`}>{m.time || ""}</div>
              </div>
            );
          })
        )}
      </div>

      <div className={`p-4 border-t ${border}`}>
        <div className={`flex items-center gap-2 rounded-2xl px-3 py-2 ${dark ? "bg-white/10" : "bg-white/60"} border ${dark ? "border-white/10" : "border-slate-900/10"}`}>
          <button className={dark ? "iconBtnDark" : "iconBtn"} aria-label="mic">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 14a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v4a3 3 0 0 0 3 3Z" stroke={dark ? "rgba(255,255,255,.85)" : "rgba(15,23,42,.75)"} strokeWidth="2"/>
              <path d="M19 11a7 7 0 0 1-14 0" stroke={dark ? "rgba(255,255,255,.85)" : "rgba(15,23,42,.75)"} strokeWidth="2" strokeLinecap="round"/>
              <path d="M12 18v3" stroke={dark ? "rgba(255,255,255,.85)" : "rgba(15,23,42,.75)"} strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>

          <input
            className={`w-full bg-transparent outline-none text-sm ${dark ? "text-white placeholder:text-white/50" : "text-slate-900 placeholder:text-slate-500"}`}
            placeholder="Type a message..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && text.trim()) {
                onSend?.(text.trim());
                setText("");
              }
            }}
          />

          <button
            className={dark ? "iconBtnDark" : "iconBtn"}
            onClick={() => {
              if (!text.trim()) return;
              onSend?.(text.trim());
              setText("");
            }}
            aria-label="send"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M4 12l16-8-6 16-2-7-8-1Z" stroke={dark ? "rgba(255,255,255,.85)" : "rgba(15,23,42,.75)"} strokeWidth="2" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}