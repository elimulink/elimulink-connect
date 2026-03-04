import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../lib/auth.js";

export default function PreJoin() {
  const { roomId } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();

  const videoRef = React.useRef(null);
  const [mic, setMic] = React.useState(true);
  const [cam, setCam] = React.useState(true);
  const [name, setName] = React.useState(user?.displayName || "");
  const [stream, setStream] = React.useState(null);

  React.useEffect(() => {
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setStream(s);
        if (videoRef.current) videoRef.current.srcObject = s;
      } catch {
        // ignore
      }
    })();
    return () => {
      stream?.getTracks()?.forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!stream) return;
    stream.getAudioTracks().forEach((t) => (t.enabled = mic));
  }, [mic, stream]);

  React.useEffect(() => {
    if (!stream) return;
    stream.getVideoTracks().forEach((t) => (t.enabled = cam));
  }, [cam, stream]);

  return (
    <div className="min-h-screen grid place-items-center px-4 py-8">
      <div className="w-full max-w-[980px] grid lg:grid-cols-2 gap-6">
        <div className="glass rounded-3xl p-4">
          <div className="rounded-3xl overflow-hidden bg-black/5 border border-slate-900/10 aspect-video relative">
            <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
            <div className="absolute left-3 top-3 pill">{name || "You"}</div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button className="iconBtn" onClick={() => setMic((v) => !v)} title="Mic">
              {mic ? "???" : "??"}
            </button>
            <button className="iconBtn" onClick={() => setCam((v) => !v)} title="Camera">
              {cam ? "??" : "??"}
            </button>
            <div className="ml-auto text-sm text-slate-600">Room: <span className="font-semibold">{roomId}</span></div>
          </div>
        </div>

        <div className="glass rounded-3xl p-7">
          <div className="text-2xl font-extrabold tracking-tight">Ready to join?</div>
          <div className="mt-1 text-sm text-slate-600">Check camera & microphone before entering the meeting.</div>

          <div className="mt-5">
            <label className="text-sm font-semibold text-slate-700">Your name</label>
            <input
              className="mt-2 w-full rounded-2xl px-4 py-3 bg-white/60 border border-slate-900/10 outline-none"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Victor"
            />
          </div>

          <div className="mt-6 flex gap-3">
            <button className="btnPrimary w-full" onClick={() => nav(`/room/${roomId}`, { state: { name } })}>
              Join now
            </button>
            <button className="btnGhost w-full" onClick={() => nav("/") }>
              Back
            </button>
          </div>

          <div className="mt-4 text-xs text-slate-500">
            Note: waiting room + admission is handled in the Room screen with backend signaling.
          </div>
        </div>
      </div>
    </div>
  );
}