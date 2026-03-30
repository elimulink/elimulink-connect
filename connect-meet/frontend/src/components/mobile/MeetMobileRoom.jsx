import React from "react";
import BottomSheet from "../BottomSheet.jsx";
import ConnectChatComposer from "../chat/ConnectChatComposer.jsx";
import MeetMobileReactionPicker from "./MeetMobileReactionPicker.jsx";
import { fetchAttachmentBlobUrl, uploadChatAttachment } from "../../lib/api.js";

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function formatMessageTime(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

function StageBadge({ children, tone = "default" }) {
  const tones = {
    default: "border-white/10 bg-black/35 text-white/78",
    danger: "border-red-300/15 bg-red-500/18 text-red-100",
    info: "border-sky-300/20 bg-sky-300/15 text-sky-100",
  };
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${tones[tone]}`}>{children}</span>;
}

function SecureAttachmentImage({ attachment }) {
  const [blobUrl, setBlobUrl] = React.useState("");

  React.useEffect(() => {
    let active = true;
    let currentUrl = "";

    if (!attachment?.id) return undefined;

    fetchAttachmentBlobUrl(attachment.id)
      .then((url) => {
        if (!active) {
          URL.revokeObjectURL(url);
          return;
        }
        currentUrl = url;
        setBlobUrl(url);
      })
      .catch(() => {
        if (active) setBlobUrl(attachment.previewUrl || attachment.url || "");
      });

    return () => {
      active = false;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [attachment?.id, attachment?.previewUrl, attachment?.url]);

  if (!blobUrl) {
    return <div className="grid h-24 w-24 place-items-center bg-white/[0.04] text-[11px] text-white/48">Loading</div>;
  }

  return <img src={blobUrl} alt={attachment.name || "Shared image"} className="h-24 w-24 object-cover" />;
}

function MobileIconButton({ label, active = false, danger = false, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={
        "grid h-12 w-12 place-items-center rounded-full border transition active:scale-[0.98] " +
        (danger
          ? "border-red-400/20 bg-[#EA4335] text-white shadow-[0_12px_24px_rgba(234,67,53,0.28)]"
          : active
            ? "border-[#5AB2F5]/20 bg-[#12304A] text-[#A8DEFF]"
            : "border-white/10 bg-white/[0.08] text-white/80")
      }
    >
      {children}
    </button>
  );
}

function StageTile({ tile, large = false, attachMedia, localStream }) {
  const muted = tile.local;
  return (
    <div className={`relative overflow-hidden rounded-[28px] border border-white/10 bg-[#09131D] ${large ? "min-h-[330px]" : "min-h-[132px]"}`}>
      <div className="absolute left-3 top-3 z-10 flex items-center gap-2">
        <StageBadge>{tile.title}</StageBadge>
        {tile.cameraOff ? <StageBadge>Camera off</StageBadge> : null}
        {tile.micMuted ? <StageBadge tone="danger">Muted</StageBadge> : null}
      </div>
      {tile.subtitle ? <div className="absolute bottom-3 left-3 z-10"><StageBadge>{tile.subtitle}</StageBadge></div> : null}
      {tile.cameraOff ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[radial-gradient(circle_at_top,rgba(17,49,75,0.9),transparent_55%),#08121B] text-white">
          <div className="grid h-20 w-20 place-items-center rounded-full border border-white/10 bg-white/[0.08] text-2xl font-semibold">{tile.initials}</div>
          <div className="mt-4 text-sm font-semibold text-white/88">Camera is off</div>
        </div>
      ) : tile.stream ? (
        <video
          autoPlay
          playsInline
          muted={muted}
          ref={(node) => attachMedia(node, tile.local ? localStream : tile.stream, { muted })}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center text-sm text-white/45">Video will appear here when available.</div>
      )}
    </div>
  );
}

function MobileTopStrip({ roomTitle, roomId, elapsedSeconds, pendingCount, onOpenChat, onOpenPeople }) {
  return (
    <div className="flex items-center gap-3 px-4 pb-3 pt-4">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-white">{roomTitle}</div>
        <div className="mt-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/42">
          <span>{roomId}</span>
          <span>{formatDuration(elapsedSeconds)}</span>
          {pendingCount > 0 ? <span>{pendingCount} waiting</span> : null}
        </div>
      </div>
      <MobileIconButton label="Open chat" onClick={onOpenChat}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M7.25 17.5 4 19.75V7a2.75 2.75 0 0 1 2.75-2.75h10.5A2.75 2.75 0 0 1 20 7v7A2.75 2.75 0 0 1 17.25 16.75h-10Z" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" /></svg>
      </MobileIconButton>
      <MobileIconButton label="Open people" onClick={onOpenPeople}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 11a3.25 3.25 0 1 0 0-6.5A3.25 3.25 0 0 0 12 11ZM5.5 19.75a6.5 6.5 0 0 1 13 0" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" /></svg>
      </MobileIconButton>
    </div>
  );
}

function MobileWaitingScreen({ roomTitle, displayName, roomError, onLeave }) {
  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(circle_at_top,rgba(17,49,75,0.34),transparent_36%),linear-gradient(180deg,#07111B,#050D16)] px-5 py-6 text-white">
      <div className="text-center">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/42">ElimuLink Meet</div>
        <h1 className="mt-3 text-[30px] font-semibold tracking-tight">{roomTitle}</h1>
      </div>
      <div className="mb-auto mt-auto rounded-[32px] border border-white/10 bg-white/[0.05] px-6 py-8 text-center shadow-[0_18px_50px_rgba(0,0,0,0.24)]">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full border border-white/10 bg-white/[0.08] text-2xl font-semibold">
          {(displayName[0] || "U").toUpperCase()}
        </div>
        <div className="mt-5 text-xl font-semibold">Hey {displayName}, someone in the meeting should let you in soon</div>
        <div className="mt-3 text-sm leading-6 text-white/62">Stay here while ElimuLink Meet waits for host admission.</div>
        {roomError ? <div className="mt-4 rounded-2xl border border-red-300/15 bg-red-500/18 px-4 py-3 text-sm text-red-100">{roomError}</div> : null}
      </div>
      <button
        type="button"
        onClick={onLeave}
        className="mt-6 rounded-[22px] border border-white/10 bg-white/[0.08] px-4 py-4 text-sm font-semibold text-white"
      >
        Leave
      </button>
    </div>
  );
}

function MobileChatScreen({ roomTitle, roomId, messages, participants, onBack, onSend }) {
  const [text, setText] = React.useState("");
  const [notices, setNotices] = React.useState([]);
  const queueNotice = React.useCallback((value) => {
    const id = `notice-${Date.now()}`;
    setNotices((prev) => [...prev, { id, text: value }]);
    window.setTimeout(() => setNotices((prev) => prev.filter((item) => item.id !== id)), 3000);
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-[#07111B] text-white">
      <div className="border-b border-white/10 px-4 pb-3 pt-4">
        <button type="button" onClick={onBack} className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-sm font-semibold text-white/84">
          Back to meeting
        </button>
        <div className="mt-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/42">Chat</div>
          <div className="mt-1 text-lg font-semibold">{roomTitle}</div>
        </div>
      </div>
      <div className="chat-scroll-area flex-1 space-y-3 overflow-auto px-4 py-4">
        {notices.map((notice) => (
          <div key={notice.id} className="rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-medium text-white/70">{notice.text}</div>
        ))}
        {messages.length === 0 ? <div className="text-sm text-white/56">No messages yet.</div> : null}
        {messages.map((message, index) => {
          const name = message.display_name || message.from_display_name || message.from_uid || "Participant";
          const attachments = Array.isArray(message.attachments) ? message.attachments : [];
          return (
            <div key={`${message.sent_at || index}-${name}`} className="rounded-[24px] border border-white/10 bg-white/[0.04] px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-white">{name}</div>
                <div className="text-[11px] text-white/38">{formatMessageTime(message.sent_at) || message.time || ""}</div>
              </div>
              {message.message ? <div className="mt-2 text-sm leading-6 text-white/76">{message.message}</div> : null}
              {attachments.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {attachments.map((attachment, attachmentIndex) => (
                    attachment?.previewUrl || attachment?.url ? (
                      <a
                        key={`${attachment.url || attachment.previewUrl}-${attachmentIndex}`}
                        href={attachment.url || attachment.previewUrl}
                        className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06]"
                        onClick={async (event) => {
                          event.preventDefault();
                          try {
                            const blobUrl = await fetchAttachmentBlobUrl(attachment.id);
                            window.open(blobUrl, "_blank", "noopener,noreferrer");
                          } catch {
                            window.open(attachment.url || attachment.previewUrl, "_blank", "noopener,noreferrer");
                          }
                        }}
                      >
                        <SecureAttachmentImage attachment={attachment} />
                      </a>
                    ) : null
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="border-t border-white/10 px-4 py-4">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] px-3 py-3">
          <div className="mb-3 flex items-center justify-between gap-3 px-1">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-white/42">In-call chat</div>
            <div className="text-[11px] text-right text-white/46">Images upload to the shared room chat when available.</div>
          </div>
          <ConnectChatComposer
            value={text}
            onChange={setText}
            mobile
            allowScreenshotSignals
            participants={participants}
            onSystemNotice={queueNotice}
            helperText="Shared images upload to this room chat."
            mentionHelperText={'Use "@" to insert someone into your message. Mention suggestions come from the current room list.'}
            onSendConnectMessage={async ({
            text: messageText,
            mentions,
            attachments,
            setAttachmentStatus,
            markUploading,
            markReady,
            markFailed,
          }) => {
            const cleanText = messageText.trim();
            const uploadedAttachments = [];

            for (const attachment of attachments || []) {
              try {
                markUploading?.(attachment.id);
                const uploaded = await uploadChatAttachment(roomId, attachment);
                uploadedAttachments.push({
                  id: uploaded.id,
                  name: uploaded.name,
                  type: uploaded.type,
                  url: uploaded.url,
                  previewUrl: uploaded.preview_url,
                  size: uploaded.size,
                  is_image: uploaded.is_image,
                });
                setAttachmentStatus?.(attachment.id, {
                  status: "ready",
                  uploadedUrl: uploaded.url,
                });
                markReady?.(attachment.id);
              } catch (error) {
                markFailed?.(attachment.id, error?.message || "Upload failed");
                queueNotice(error?.message || "Attachment upload failed.");
                return false;
              }
            }

              await onSend({
                text: cleanText,
                mentions,
                attachments: uploadedAttachments,
              });
              setText("");
              return true;
            }}
          />
        </div>
      </div>
    </div>
  );
}

function ParticipantRow({ person, hostSessionId, currentSessionId, isHost, onLowerHand, onRemove, onTransferHost }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">{person.display_name || person.uid}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-white/42">
            {person.session_id === hostSessionId ? <span>Host</span> : null}
            {person.session_id === currentSessionId ? <span>You</span> : null}
            {person.hand_raised ? <span>Hand raised</span> : null}
            {person.audio_enabled === false ? <span>Muted</span> : null}
            {person.video_enabled === false ? <span>Camera off</span> : null}
          </div>
        </div>
        {isHost && person.session_id !== currentSessionId ? (
          <div className="flex flex-col gap-2">
            {person.hand_raised ? <button type="button" onClick={() => onLowerHand?.(person)} className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/80">Lower hand</button> : null}
            <button type="button" onClick={() => onTransferHost?.(person)} className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/80">Make host</button>
            <button type="button" onClick={() => onRemove?.(person)} className="rounded-full bg-red-500/18 px-3 py-1.5 text-xs font-semibold text-red-100">Remove</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MobilePeopleScreen({
  roomTitle,
  members,
  pending,
  hostSessionId,
  currentSessionId,
  isHost,
  onBack,
  onAdmit,
  onAdmitAll,
  onRemove,
  onLowerHand,
  onTransferHost,
}) {
  return (
    <div className="flex min-h-screen flex-col bg-[#07111B] text-white">
      <div className="border-b border-white/10 px-4 pb-3 pt-4">
        <button type="button" onClick={onBack} className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-sm font-semibold text-white/84">
          Back to meeting
        </button>
        <div className="mt-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/42">People</div>
          <div className="mt-1 text-lg font-semibold">{roomTitle}</div>
          <div className="mt-1 text-sm text-white/56">{members.length} in meeting</div>
        </div>
      </div>
      <div className="flex-1 overflow-auto px-4 py-4">
        <div className="space-y-5">
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-white/42">Waiting in lobby</div>
              {isHost && pending.length > 1 ? <button type="button" onClick={onAdmitAll} className="rounded-full bg-emerald-400/14 px-3 py-1.5 text-xs font-semibold text-emerald-100">Admit all</button> : null}
            </div>
            {pending.length === 0 ? <div className="text-sm text-white/52">No one is waiting right now.</div> : null}
            {pending.map((person) => (
              <div key={person.session_id || person.uid} className="rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">{person.display_name || person.uid}</div>
                    <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-white/42">Host admission required</div>
                  </div>
                  {isHost ? <button type="button" onClick={() => onAdmit?.(person)} className="rounded-full bg-emerald-400/14 px-3 py-1.5 text-xs font-semibold text-emerald-100">Admit</button> : null}
                </div>
              </div>
            ))}
          </section>

          <section className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-white/42">In meeting</div>
            {members.map((person) => (
              <ParticipantRow
                key={person.session_id || person.uid}
                person={person}
                hostSessionId={hostSessionId}
                currentSessionId={currentSessionId}
                isHost={isHost}
                onRemove={onRemove}
                onLowerHand={onLowerHand}
                onTransferHost={onTransferHost}
              />
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}

function SettingsToggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-[20px] border border-white/10 bg-white/[0.04] px-4 py-3">
      <span className="text-sm font-semibold text-white/84">{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function MobileSettingsScreen({
  roomTitle,
  preferences,
  onBack,
  onChangePreferences,
  microphoneOptions,
  speakerOptions,
  cameraOptions,
  onTestSpeaker,
}) {
  const [tab, setTab] = React.useState("audio");
  const tabs = [
    ["audio", "Audio"],
    ["video", "Video"],
    ["general", "General"],
    ["captions", "Captions"],
    ["reactions", "Reactions"],
  ];
  return (
    <div className="flex min-h-screen flex-col bg-[#07111B] text-white">
      <div className="border-b border-white/10 px-4 pb-3 pt-4">
        <button type="button" onClick={onBack} className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-sm font-semibold text-white/84">
          Back to meeting
        </button>
        <div className="mt-4 text-lg font-semibold">{roomTitle}</div>
        <div className="mt-1 text-sm text-white/56">Mobile settings</div>
        <div className="mt-4 flex flex-wrap gap-2">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] ${tab === id ? "bg-[#12304A] text-[#A8DEFF]" : "border border-white/10 text-white/64"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-auto px-4 py-4">
        {tab === "audio" ? (
          <div className="space-y-3">
            <select value={preferences.selectedMicId} onChange={(event) => onChangePreferences({ selectedMicId: event.target.value })} className="meet-form-select">
              {microphoneOptions.map((option) => <option key={option.value || "mic-default"} value={option.value}>{option.label}</option>)}
            </select>
            <select value={preferences.selectedSpeakerId} onChange={(event) => onChangePreferences({ selectedSpeakerId: event.target.value })} className="meet-form-select">
              {speakerOptions.map((option) => <option key={option.value || "speaker-default"} value={option.value}>{option.label}</option>)}
            </select>
            <button type="button" onClick={onTestSpeaker} className="w-full rounded-[20px] border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-semibold text-white">Test speaker</button>
          </div>
        ) : null}
        {tab === "video" ? (
          <div className="space-y-3">
            <select value={preferences.selectedCameraId} onChange={(event) => onChangePreferences({ selectedCameraId: event.target.value })} className="meet-form-select">
              {cameraOptions.map((option) => <option key={option.value || "camera-default"} value={option.value}>{option.label}</option>)}
            </select>
            <div className="rounded-[20px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/64">Background effects remain lightweight and local in this phase.</div>
          </div>
        ) : null}
        {tab === "general" ? (
          <div className="space-y-3">
            <div className="rounded-[20px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/70">Current device choices are stored locally for this browser and reused when you rejoin.</div>
          </div>
        ) : null}
        {tab === "captions" ? (
          <div className="space-y-3">
            <SettingsToggle label="Caption preferences" checked={preferences.captionsEnabled} onChange={(checked) => onChangePreferences({ captionsEnabled: checked })} />
            <div className="rounded-[20px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/64">Live transcription is not wired yet. These are baseline local preferences only.</div>
          </div>
        ) : null}
        {tab === "reactions" ? (
          <div className="space-y-3">
            <SettingsToggle label="Show reactions from others" checked={preferences.reactionsEnabled} onChange={(checked) => onChangePreferences({ reactionsEnabled: checked })} />
            <SettingsToggle label="Reaction animations" checked={preferences.reactionsAnimation} onChange={(checked) => onChangePreferences({ reactionsAnimation: checked })} />
            <SettingsToggle label="Reaction sound" checked={preferences.reactionsSound} onChange={(checked) => onChangePreferences({ reactionsSound: checked })} />
            <label className="flex items-center justify-between gap-3 rounded-[20px] border border-white/10 bg-white/[0.04] px-4 py-3">
              <span className="text-sm font-semibold text-white/84">Default skin tone</span>
              <select
                value={preferences.reactionSkinTone || "default"}
                onChange={(event) => onChangePreferences({ reactionSkinTone: event.target.value })}
                className="rounded-full border border-white/10 bg-[#09131D] px-3 py-2 text-xs font-semibold text-white"
              >
                <option value="default">Default</option>
                <option value="light">Light</option>
                <option value="mediumLight">Medium-light</option>
                <option value="medium">Medium</option>
                <option value="mediumDark">Medium-dark</option>
                <option value="dark">Dark</option>
              </select>
            </label>
            <div className="rounded-[20px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/64">Emoji events are shared with the room. Animation, sound, and skin tone stay local to this device.</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MoreAction({ title, note, onClick, disabled = false }) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`flex w-full items-center justify-between rounded-[22px] border px-4 py-4 text-left ${disabled ? "border-white/10 bg-white/[0.04] text-white/34" : "border-white/10 bg-white/[0.06] text-white"}`}
    >
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-white/46">{note}</span>
      </span>
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">{disabled ? "Staged" : "Open"}</span>
    </button>
  );
}

export default function MeetMobileRoom({
  roomTitle,
  roomId,
  displayName,
  hostName,
  presenterName,
  presenterSessionId,
  currentSessionId,
  hostSessionId,
  members,
  pending,
  hostUid,
  myUid,
  isHost,
  admitted,
  localTile,
  remoteTiles,
  spotlightTile,
  sideTiles,
  localStream,
  isPresenting,
  roomError,
  audioEnabled,
  videoEnabled,
  myHandRaised,
  preferences,
  messages,
  reactionBursts,
  reactionTrayOpen,
  microphoneOptions,
  speakerOptions,
  cameraOptions,
  changePreferences,
  attachMedia,
  sendReaction,
  onToggleReactionTray,
  toggleTrack,
  toggleRaisedHand,
  shareScreen,
  stopPresenting,
  leaveMeeting,
  onSendChat,
  onAdmit,
  onAdmitAll,
  onRemove,
  onLowerHand,
  onTransferHost,
  copyInviteLink,
  canShareScreen,
  testSpeaker,
}) {
  const [surface, setSurface] = React.useState("stage");
  const [moreOpen, setMoreOpen] = React.useState(false);
  const [expandedReactionPickerOpen, setExpandedReactionPickerOpen] = React.useState(false);
  const [elapsedSeconds, setElapsedSeconds] = React.useState(0);
  const isLocalPresenter = Boolean(presenterSessionId && presenterSessionId === currentSessionId);
  const activePresentation = Boolean(presenterSessionId);

  React.useEffect(() => {
    const started = Date.now();
    const id = window.setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - started) / 1000)));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const presentedRemoteTile = activePresentation
    ? remoteTiles.find((tile) => tile.sessionId === presenterSessionId) || null
    : null;
  const primaryTile = activePresentation
    ? (isLocalPresenter ? localTile : presentedRemoteTile || spotlightTile || remoteTiles[0] || localTile)
    : (spotlightTile || remoteTiles[0] || localTile);
  const floatingTile = primaryTile?.uid === "local" ? remoteTiles[0] || null : localTile;
  const stageTiles = sideTiles.length ? sideTiles.slice(0, 3) : remoteTiles.slice(0, 3);

  if (!admitted) {
    return <MobileWaitingScreen roomTitle={roomTitle} displayName={displayName} roomError={roomError} onLeave={leaveMeeting} />;
  }

  if (surface === "chat") {
    return (
      <MobileChatScreen
        roomTitle={roomTitle}
        roomId={roomId}
        messages={messages}
        participants={members}
        onBack={() => setSurface("stage")}
        onSend={onSendChat}
      />
    );
  }

  if (surface === "people") {
    return (
      <MobilePeopleScreen
        roomTitle={roomTitle}
        members={members}
        pending={pending}
        hostSessionId={hostSessionId}
        currentSessionId={currentSessionId}
        isHost={isHost}
        onBack={() => setSurface("stage")}
        onAdmit={onAdmit}
        onAdmitAll={onAdmitAll}
        onRemove={onRemove}
        onLowerHand={onLowerHand}
        onTransferHost={onTransferHost}
      />
    );
  }

  if (surface === "settings") {
    return (
      <MobileSettingsScreen
        roomTitle={roomTitle}
        preferences={preferences}
        onBack={() => setSurface("stage")}
        onChangePreferences={changePreferences}
        microphoneOptions={microphoneOptions}
        speakerOptions={speakerOptions}
        cameraOptions={cameraOptions}
        onTestSpeaker={testSpeaker}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#07111B] text-white">
      <MobileTopStrip
        roomTitle={roomTitle}
        roomId={roomId}
        elapsedSeconds={elapsedSeconds}
        pendingCount={pending.length}
        onOpenChat={() => setSurface("chat")}
        onOpenPeople={() => setSurface("people")}
      />

      <div className="relative px-4 pb-[116px]">
        {roomError ? <div className="mb-3 rounded-[20px] border border-red-300/15 bg-red-500/18 px-4 py-3 text-sm text-red-100">{roomError}</div> : null}
        {activePresentation ? (
          <div className="mb-3 flex items-center justify-between gap-3 rounded-[20px] border border-sky-300/20 bg-sky-300/14 px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-sky-50">{isLocalPresenter ? "You are presenting" : `${presenterName || "Someone"} is presenting`}</div>
              <div className="mt-1 text-xs text-sky-100/72">Presented content stays prioritized on the main stage.</div>
            </div>
            <button type="button" onClick={stopPresenting} className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-slate-900" disabled={!isLocalPresenter}>
              Stop
            </button>
          </div>
        ) : null}

        <StageTile tile={{
          ...primaryTile,
          cameraOff: primaryTile?.videoEnabled === false,
          micMuted: primaryTile?.audioEnabled === false,
        }} large attachMedia={attachMedia} localStream={localStream} />

        {floatingTile ? (
          <div className="absolute right-7 top-[92px] w-[104px]">
            <StageTile
              tile={{
                ...floatingTile,
                cameraOff: floatingTile.videoEnabled === false,
                micMuted: floatingTile.audioEnabled === false,
              }}
              attachMedia={attachMedia}
              localStream={localStream}
            />
          </div>
        ) : null}

        {stageTiles.length > 0 ? (
          <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
            {stageTiles.filter((tile) => tile.uid !== primaryTile?.uid && tile.uid !== floatingTile?.uid).map((tile) => (
              <div key={tile.uid} className="min-w-[132px] flex-1">
                <StageTile
                  tile={{
                    ...tile,
                    cameraOff: tile.videoEnabled === false,
                    micMuted: tile.audioEnabled === false,
                  }}
                  attachMedia={attachMedia}
                  localStream={localStream}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-[20px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/56">
            No one else is in the meeting yet.
          </div>
        )}

        {reactionBursts.length ? (
          <div className="pointer-events-none absolute right-4 top-16 z-10 flex flex-col items-end gap-2">
            {reactionBursts.slice(-3).map((reaction) => (
              <div key={reaction.id} className="rounded-full border border-white/10 bg-white/[0.12] px-3 py-2 text-sm font-semibold text-white">
                {reaction.emoji} {reaction.fromUid === myUid ? "You" : reaction.displayName}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-[rgba(4,10,18,0.94)] px-3 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <MeetMobileReactionPicker
          open={reactionTrayOpen}
          skinTone={preferences.reactionSkinTone}
          onSend={sendReaction}
          onToggleExpanded={() => setExpandedReactionPickerOpen(true)}
        />
        <div className="flex items-center justify-between gap-2">
          <MobileIconButton label={videoEnabled ? "Turn camera off" : "Turn camera on"} active={videoEnabled} onClick={() => toggleTrack("video")}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="4" y="7" width="11" height="10" rx="2.4" stroke="currentColor" strokeWidth="1.8" /><path d="m15 10 5-3v10l-5-3" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>
          </MobileIconButton>
          <MobileIconButton label={audioEnabled ? "Mute microphone" : "Unmute microphone"} active={audioEnabled} onClick={() => toggleTrack("audio")}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 17a4 4 0 0 0 4-4V8a4 4 0 0 0-8 0v5a4 4 0 0 0 4 4Z" stroke="currentColor" strokeWidth="1.8" /><path d="M5 11.5a7 7 0 1 0 14 0M12 18.5V21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </MobileIconButton>
          <MobileIconButton label="Audio settings" onClick={() => setSurface("settings")}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M5 10.5V8.8A1.8 1.8 0 0 1 6.8 7h6.4A1.8 1.8 0 0 1 15 8.8v6.4a1.8 1.8 0 0 1-1.8 1.8H6.8A1.8 1.8 0 0 1 5 15.2v-1.7M15 10l4-2.5v9L15 14" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>
          </MobileIconButton>
          <MobileIconButton label="Reactions" active={reactionTrayOpen} onClick={onToggleReactionTray}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" /><path d="M8.75 13.8c.85 1.15 1.95 1.7 3.25 1.7s2.4-.55 3.25-1.7M9.2 10h.01M14.8 10h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </MobileIconButton>
          <MobileIconButton label="More" onClick={() => setMoreOpen(true)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 12h.01M12 12h.01M18 12h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
          </MobileIconButton>
          <MobileIconButton label="Leave meeting" danger onClick={leaveMeeting}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M8.5 12h6.25M16.5 9.5l3 2.5-3 2.5" stroke="currentColor" strokeWidth="1.95" strokeLinecap="round" strokeLinejoin="round" /><path d="M14.5 5.25H9A3.75 3.75 0 0 0 5.25 9v6A3.75 3.75 0 0 0 9 18.75h5.5" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" /></svg>
          </MobileIconButton>
        </div>
      </div>

      <BottomSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        panelClassName="max-w-none rounded-t-[28px] border-white/10 bg-[#09131D] text-white shadow-[0_-20px_44px_rgba(0,0,0,0.34)]"
      >
        <div className="space-y-3">
          <MoreAction title="Chat" note="Open the meeting chat" onClick={() => { setMoreOpen(false); setSurface("chat"); }} />
          <MoreAction title="People" note="View participants and the lobby" onClick={() => { setMoreOpen(false); setSurface("people"); }} />
          <MoreAction title="Share" note={canShareScreen ? "Start screen sharing" : "Screen sharing depends on browser support"} onClick={() => { if (canShareScreen) { setMoreOpen(false); shareScreen(); } }} disabled={!canShareScreen} />
          <MoreAction title="Captions" note="Toggle caption preferences" onClick={() => { changePreferences({ captionsEnabled: !preferences.captionsEnabled }); setMoreOpen(false); }} />
          <MoreAction title="Settings" note="Audio, video, captions, reactions" onClick={() => { setMoreOpen(false); setSurface("settings"); }} />
          <MoreAction title="Invite others" note="Copy the meeting link" onClick={() => { copyInviteLink(); setMoreOpen(false); }} />
          <MoreAction title={myHandRaised ? "Lower hand" : "Raise hand"} note="Signal to the room" onClick={() => { toggleRaisedHand(); setMoreOpen(false); }} />
        </div>
      </BottomSheet>

      <BottomSheet
        open={expandedReactionPickerOpen}
        onClose={() => setExpandedReactionPickerOpen(false)}
        panelClassName="max-w-none rounded-t-[28px] border-white/10 bg-[#09131D] text-white shadow-[0_-20px_44px_rgba(0,0,0,0.34)]"
      >
        <MeetMobileReactionPicker
          expanded
          skinTone={preferences.reactionSkinTone}
          onSend={(emoji) => {
            sendReaction(emoji);
            setExpandedReactionPickerOpen(false);
          }}
          onCloseExpanded={() => setExpandedReactionPickerOpen(false)}
        />
      </BottomSheet>
    </div>
  );
}
