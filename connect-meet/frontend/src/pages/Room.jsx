import React from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import ChatPanel from "../components/ChatPanel.jsx";
import ParticipantsPanel from "../components/ParticipantsPanel.jsx";
import BottomSheet from "../components/BottomSheet.jsx";
import { getCurrentUser, getIdToken, signOut, useAuth } from "../lib/auth";
import { applyAnswer, applyOffer, bufferOrAddIce, createPeer, flushIce, makeOffer } from "../lib/webrtc";

export default function Room() {
  const { roomId } = useParams();
  const nav = useNavigate();
  const loc = useLocation();
  const { user } = useAuth();

  const wsRef = React.useRef(null);
  const localStreamRef = React.useRef(null);
  const peersRef = React.useRef(new Map());

  const [remoteStreams, setRemoteStreams] = React.useState(new Map());
  const [members, setMembers] = React.useState([]);
  const [pending, setPending] = React.useState([]);
  const [hostUid, setHostUid] = React.useState(null);
  const [admitted, setAdmitted] = React.useState(false);
  const [messages, setMessages] = React.useState([]);

  const [showChat, setShowChat] = React.useState(true);
  const [showPeople, setShowPeople] = React.useState(false);
  const [mobilePanel, setMobilePanel] = React.useState(false);

  const myUid = React.useMemo(() => getCurrentUser()?.uid, []);
  const displayName = loc?.state?.name || user?.displayName || user?.email || "You";

  React.useEffect(() => {
    if (localStreamRef.current) return;
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        localStreamRef.current = stream;
      });
  }, []);

  function sendMessage(msg) {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ room_id: roomId, ...msg }));
  }

  function ensurePeer(remoteUid) {
    if (peersRef.current.has(remoteUid)) return peersRef.current.get(remoteUid);

    const pc = createPeer({
      localStream: localStreamRef.current,
      onIce: (candidate) => {
        sendMessage({ type: "ice", to_uid: remoteUid, payload: candidate });
      },
      onTrack: (stream) => {
        setRemoteStreams((prev) => {
          const next = new Map(prev);
          next.set(remoteUid, stream);
          return next;
        });
      }
    });

    peersRef.current.set(remoteUid, pc);
    return pc;
  }

  async function handlePresence(msg) {
    const nextMembers = msg.members || [];
    const nextPending = msg.pending || [];
    setMembers(nextMembers);
    setPending(nextPending);
    setHostUid(msg.host_uid);

    const inMembers = nextMembers.some((m) => m.uid === myUid);
    setAdmitted(inMembers);

    if (msg.host_uid === myUid && inMembers) {
      for (const m of nextMembers) {
        if (m.uid === myUid) continue;
        if (peersRef.current.has(m.uid)) continue;
        const pc = ensurePeer(m.uid);
        const offer = await makeOffer(pc);
        sendMessage({ type: "offer", to_uid: m.uid, payload: offer });
      }
    }
  }

  React.useEffect(() => {
    let active = true;

    async function connect() {
      const userNow = getCurrentUser();
      if (!userNow) {
        nav("/login");
        return;
      }
      const token = await getIdToken();
      if (!token) {
        await signOut();
        nav("/login");
        return;
      }

      const ws = new WebSocket(`ws://localhost:8000/ws/rooms/${roomId}?token=${token}`);
      wsRef.current = ws;

      ws.onmessage = async (event) => {
        if (!active) return;
        const msg = JSON.parse(event.data);
        const type = msg.type;

        if (type === "presence") {
          await handlePresence(msg);
          return;
        }

        if (type === "admitted") {
          setAdmitted(true);
          return;
        }

        if (type === "offer") {
          const fromUid = msg.from_uid;
          if (!fromUid || fromUid === myUid) return;
          if (hostUid === myUid) return;
          const pc = ensurePeer(fromUid);
          const answer = await applyOffer(pc, msg.payload);
          sendMessage({ type: "answer", to_uid: fromUid, payload: answer });
          await flushIce(pc, fromUid);
          return;
        }

        if (type === "answer") {
          const fromUid = msg.from_uid;
          const pc = peersRef.current.get(fromUid);
          if (pc) {
            await applyAnswer(pc, msg.payload);
            await flushIce(pc, fromUid);
          }
          return;
        }

        if (type === "ice") {
          const fromUid = msg.from_uid;
          if (!fromUid) return;
          const pc = ensurePeer(fromUid);
          await bufferOrAddIce(pc, fromUid, msg.payload);
          return;
        }

        if (type === "chat_message") {
          setMessages((prev) => [
            ...prev,
            {
              message: msg.message,
              from_uid: msg.from_uid,
              display_name: msg.display_name || msg.from_uid
            }
          ]);
          return;
        }

        if (type === "leave") {
          const fromUid = msg.from_uid;
          if (fromUid) {
            const pc = peersRef.current.get(fromUid);
            if (pc) pc.close();
            peersRef.current.delete(fromUid);
            setRemoteStreams((prev) => {
              const next = new Map(prev);
              next.delete(fromUid);
              return next;
            });
          }
          return;
        }

        if (type === "remove") {
          cleanup();
          nav("/");
        }
      };

      ws.onclose = () => {
        cleanup();
      };
    }

    connect();

    return () => {
      active = false;
      cleanup();
    };
  }, [roomId]);

  function cleanup() {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "leave", room_id: roomId }));
      ws.close();
    }
    wsRef.current = null;

    peersRef.current.forEach((pc) => pc.close());
    peersRef.current.clear();

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    localStreamRef.current = null;

    setRemoteStreams(new Map());
  }

  function toggleTrack(kind) {
    const stream = localStreamRef.current;
    if (!stream) return;
    const tracks = kind === "audio" ? stream.getAudioTracks() : stream.getVideoTracks();
    tracks.forEach((t) => (t.enabled = !t.enabled));
  }

  async function shareScreen() {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    const screenTrack = stream.getVideoTracks()[0];
    const local = localStreamRef.current;
    if (!local) return;

    const senderReplace = (pc) => {
      const sender = pc.getSenders().find((s) => s.track && s.track.kind === "video");
      if (sender) sender.replaceTrack(screenTrack);
    };

    peersRef.current.forEach(senderReplace);

    const localVideoTrack = local.getVideoTracks()[0];
    if (localVideoTrack) localVideoTrack.stop();
    local.removeTrack(localVideoTrack);
    local.addTrack(screenTrack);

    screenTrack.onended = () => {
      navigator.mediaDevices.getUserMedia({ video: true }).then((camStream) => {
        const camTrack = camStream.getVideoTracks()[0];
        peersRef.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track && s.track.kind === "video");
          if (sender) sender.replaceTrack(camTrack);
        });
        local.removeTrack(screenTrack);
        local.addTrack(camTrack);
      });
    };
  }

  return (
    <div className="min-h-screen px-3 md:px-5 py-5">
      <div className="mx-auto max-w-[1320px]">
        <div className="darkShell rounded-3xl overflow-hidden">
          <div className="px-5 py-4 flex items-center gap-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="h-7 w-7 rounded-full bg-[rgba(59,138,107,.22)] grid place-items-center">
                <span className="h-3 w-3 rounded-full bg-[rgba(59,138,107,.95)]"></span>
              </span>
              <div className="font-semibold text-white/90">ElimuLink</div>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <button className="iconBtnDark" title="More">?</button>
              <button className="iconBtnDark" title="Settings">??</button>
              <div className="h-10 w-10 rounded-full bg-white/10 border border-white/10 grid place-items-center font-bold text-white">
                {(displayName[0] || "U").toUpperCase()}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px]">
            <div className="p-4 md:p-5">
              {!admitted ? (
                <div className="mb-4 rounded-2xl bg-white/10 text-white/80 px-4 py-3 text-sm">
                  Waiting for host to admit you…
                </div>
              ) : null}

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="col-span-2 md:col-span-1 md:row-span-2 rounded-3xl overflow-hidden bg-white/5 border border-white/10 relative">
                  <div className="absolute left-3 top-3 pill bg-white/10 border-white/10 text-white">
                    {displayName}
                  </div>
                  <video
                    autoPlay
                    playsInline
                    muted
                    ref={(el) => {
                      if (el && localStreamRef.current) el.srcObject = localStreamRef.current;
                    }}
                    className="h-full w-full object-cover min-h-[260px]"
                  />
                </div>

                {Array.from(remoteStreams.entries()).map(([uid, stream]) => (
                  <div key={uid} className="rounded-3xl overflow-hidden bg-white/5 border border-white/10 relative">
                    <div className="absolute left-3 top-3 pill bg-white/10 border-white/10 text-white">
                      {uid}
                    </div>
                    <video
                      autoPlay
                      playsInline
                      ref={(el) => {
                        if (el) el.srcObject = stream;
                      }}
                      className="aspect-video h-full w-full object-cover"
                    />
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-center gap-2">
                <button className="iconBtnDark" onClick={() => toggleTrack("audio")} title="Mic">
                  ???
                </button>
                <button className="iconBtnDark" onClick={() => toggleTrack("video")} title="Camera">
                  ??
                </button>
                <button className="iconBtnDark" onClick={shareScreen} title="Screen share">???</button>
                <button className="iconBtnDark" title="Raise hand">?</button>
                <button className="iconBtnDark lg:hidden" onClick={() => setMobilePanel(true)} title="Panels">??</button>

                <button
                  className="mx-1 rounded-full px-6 py-3 font-semibold bg-red-600 text-white active:scale-[0.99]"
                  onClick={() => {
                    cleanup();
                    nav("/");
                  }}
                  title="Leave"
                >
                  Leave
                </button>

                <button className="iconBtnDark" onClick={() => { setShowChat(true); setShowPeople(false); }} title="Chat">
                  ??
                </button>
                <button className="iconBtnDark" onClick={() => { setShowPeople(true); setShowChat(false); }} title="Participants">
                  ??
                </button>
              </div>
            </div>

            <div className="hidden lg:block p-4 md:p-5 border-l border-white/10">
              {showPeople ? (
                <ParticipantsPanel
                  dark
                  members={members}
                  pending={pending}
                  hostUid={hostUid}
                  myUid={myUid}
                  onAdmit={(uid) => sendMessage({ type: "admit", uid })}
                  onRemove={(uid) => sendMessage({ type: "remove", to_uid: uid })}
                />
              ) : (
                <ChatPanel
                  dark
                  messages={messages}
                  onSend={(text) => sendMessage({ type: "chat_message", message: text })}
                />
              )}
            </div>
          </div>
        </div>

        <BottomSheet open={mobilePanel} onClose={() => setMobilePanel(false)}>
          <div className="flex gap-2 mb-3">
            <button
              className={`pill ${!showPeople ? "bg-[rgba(47,111,87,.16)] text-[rgba(47,111,87,.95)]" : ""}`}
              onClick={() => { setShowPeople(false); }}
            >
              Chat
            </button>
            <button
              className={`pill ${showPeople ? "bg-[rgba(47,111,87,.16)] text-[rgba(47,111,87,.95)]" : ""}`}
              onClick={() => { setShowPeople(true); }}
            >
              Participants
            </button>
          </div>
          <div className="h-[420px]">
            {showPeople ? (
              <ParticipantsPanel
                dark
                members={members}
                pending={pending}
                hostUid={hostUid}
                myUid={myUid}
                onAdmit={(uid) => sendMessage({ type: "admit", uid })}
                onRemove={(uid) => sendMessage({ type: "remove", to_uid: uid })}
              />
            ) : (
              <ChatPanel
                dark
                messages={messages}
                onSend={(text) => sendMessage({ type: "chat_message", message: text })}
              />
            )}
          </div>
        </BottomSheet>
      </div>
    </div>
  );
}