import React from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "../components/TopBar.jsx";
import Drawer from "../components/Drawer.jsx";
import ChatPanel from "../components/ChatPanel.jsx";
import { useAuth } from "../lib/auth.js";

function randRoom() {
  const s = Math.random().toString(36).slice(2, 10);
  return `room-${s}`;
}

export default function Lobby() {
  const nav = useNavigate();
  const { user, logout } = useAuth();
  const [drawer, setDrawer] = React.useState(false);

  const right = (
    <>
      <button className="iconBtn" aria-label="search">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z" stroke="rgba(15,23,42,.75)" strokeWidth="2"/>
          <path d="M21 21l-4.3-4.3" stroke="rgba(15,23,42,.75)" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </button>
      <button className="iconBtn" aria-label="settings">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" stroke="rgba(15,23,42,.75)" strokeWidth="2"/>
          <path d="M19.4 15a7.9 7.9 0 0 0 .1-1l2-1.2-2-3.6-2.3.5a7.7 7.7 0 0 0-1.7-1L13.9 4h-3.8L9.5 7.7a7.7 7.7 0 0 0-1.7 1L5.5 8.2 3.5 11.8l2 1.2a7.9 7.9 0 0 0 .1 1l-2 1.2 2 3.6 2.3-.5a7.7 7.7 0 0 0 1.7 1L10.1 20h3.8l.6-3.7a7.7 7.7 0 0 0 1.7-1l2.3.5 2-3.6-2-1.2Z"
            stroke="rgba(15,23,42,.55)" strokeWidth="1.6" strokeLinejoin="round"/>
        </svg>
      </button>

      <button
        className="h-10 w-10 rounded-full bg-[rgba(59,138,107,.18)] border border-[rgba(15,23,42,.10)] grid place-items-center font-bold text-[rgba(47,111,87,.95)]"
        title={user?.displayName || "Profile"}
        onClick={logout}
      >
        {(user?.displayName?.[0] || "U").toUpperCase()}
      </button>
    </>
  );

  return (
    <div className="min-h-screen">
      <Drawer open={drawer} onClose={() => setDrawer(false)} user={user} />

      <div className="mx-auto max-w-[1240px] px-4 md:px-6 pt-6 pb-10">
        <div className="glass rounded-3xl overflow-hidden">
          <TopBar title="ElimuLink  Connect Meet" onMenu={() => setDrawer(true)} right={right} />

          <div className="px-6 pb-6">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
              <div className="glass2 rounded-3xl p-7">
                <div className="text-4xl font-extrabold tracking-tight">
                  ElimuLink <span className="font-black">Connect Meet</span>
                </div>
                <div className="mt-2 text-sm text-slate-600">
                  Enter your friend contacts or a meeting code
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    className="btnPrimary flex items-center gap-2"
                    onClick={() => nav(`/meet/${randRoom()}`)}
                  >
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-white/15 border border-white/20">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path d="M12 5v14" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                        <path d="M5 12h14" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    </span>
                    Create Link
                  </button>

                  <button className="btnGhost flex items-center gap-2">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-white/60 border border-slate-900/10">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path d="M7 3v4M17 3v4" stroke="rgba(15,23,42,.75)" strokeWidth="2" strokeLinecap="round"/>
                        <path d="M5 9h14" stroke="rgba(15,23,42,.35)" strokeWidth="2" strokeLinecap="round"/>
                        <path d="M6 6h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" stroke="rgba(15,23,42,.55)" strokeWidth="1.8"/>
                      </svg>
                    </span>
                    Schedule Meeting
                  </button>

                  <button className="btnGhost flex items-center gap-2">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-white/60 border border-slate-900/10">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path d="M16 11a4 4 0 1 0-8 0" stroke="rgba(15,23,42,.7)" strokeWidth="2" strokeLinecap="round"/>
                        <path d="M4 20a7 7 0 0 1 16 0" stroke="rgba(15,23,42,.5)" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    </span>
                    Group Call
                  </button>
                </div>

                <div className="mt-8 text-sm font-semibold text-slate-600">Recent meetings</div>
                <div className="mt-3 grid sm:grid-cols-2 gap-3">
                  {[
                    { title: "Data Structures Lecture", subtitle: "AI Assistant Q&A" },
                    { title: "AI Lab Meeting", subtitle: "Project sync" },
                  ].map((m) => (
                    <div key={m.title} className="rounded-2xl bg-white/60 border border-slate-900/10 px-4 py-3 flex items-center gap-3">
                      <div className="h-10 w-10 rounded-2xl bg-[rgba(47,111,87,.16)] grid place-items-center font-bold text-[rgba(47,111,87,.95)]">
                        {m.title[0]}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{m.title}</div>
                        <div className="text-xs text-slate-500 truncate">{m.subtitle}</div>
                      </div>
                      <button className="ml-auto iconBtn" aria-label="open">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                          <path d="M10 8l6 4-6 4V8Z" fill="rgba(15,23,42,.75)"/>
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="hidden lg:block">
                <ChatPanel
                  dark
                  messages={[
                    { name: "Victor", text: "Draft # Common", time: "0:20" },
                    { name: "Alice", text: "Onate vator mess net.", time: "0:18" },
                    { name: "John", text: "Let’s begin.", time: "0:01" },
                  ]}
                  onSend={() => {}}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="lg:hidden mt-5">
          <ChatPanel
            dark
            messages={[
              { name: "Victor", text: "Draft # Common", time: "0:20" },
              { name: "Alice", text: "Onate vator mess net.", time: "0:18" },
              { name: "John", text: "Let’s begin.", time: "0:01" },
            ]}
            onSend={() => {}}
          />
        </div>
      </div>
    </div>
  );
}