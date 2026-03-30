import React from "react";
import ChatSystemNotice from "./chat/ChatSystemNotice.jsx";
import ConnectAudioOverlay from "./chat/ConnectAudioOverlay.jsx";
import ConnectChatComposer from "./chat/ConnectChatComposer.jsx";
import AttachmentPreviewModal from "./chat/AttachmentPreviewModal.jsx";
import { messageMentionsUser, splitMessageWithMentions } from "./chat/chatMentions.js";
import { fetchAttachmentBlobUrl, uploadChatAttachment } from "../lib/api.js";

function makeNoticeId() {
  return `notice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeIncomingAttachment(attachment, index) {
  if (!attachment?.url && !attachment?.previewUrl) return null;
  return {
    id: attachment.id || `incoming-${index}`,
    name: attachment.name || `Image ${index + 1}`,
    type: attachment.type || "image/png",
    url: attachment.url || attachment.previewUrl,
    previewUrl: attachment.previewUrl || attachment.url,
    status: attachment.status || "ready",
    size: attachment.size || 0,
    isImage:
      attachment.is_image ??
      attachment.isImage ??
      String(attachment.type || "").startsWith("image/"),
  };
}

function formatAttachmentSize(size) {
  if (!size) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function SecureAttachmentImage({ attachment, alt, className = "" }) {
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
    return <div className={`grid place-items-center bg-slate-200/20 text-[11px] text-slate-500 ${className}`}>Loading image</div>;
  }

  return <img src={blobUrl} alt={alt} className={className} />;
}

function MessageBody({ dark, text, mentions }) {
  const parts = splitMessageWithMentions(text, mentions);

  return (
    <div className={`text-sm ${dark ? "text-white/78" : "text-slate-600"} break-words`}>
      {parts.map((part, index) =>
        part.type === "mention" ? (
          <span
            key={`${part.value}-${index}`}
            className={`inline-flex rounded-full px-2 py-0.5 text-[12px] font-semibold ${
              dark ? "bg-[#11314B] text-[#A8DEFF]" : "bg-[#EAF4FF] text-[#0B5FA8]"
            }`}
          >
            {part.value}
          </span>
        ) : (
          <React.Fragment key={`${part.value}-${index}`}>{part.value}</React.Fragment>
        )
      )}
    </div>
  );
}

export default function ChatPanel({
  dark,
  messages = [],
  onSend,
  allowScreenshotSignals = true,
  roomId,
  participants = [],
  currentUserId = "",
}) {
  const [text, setText] = React.useState("");
  const [notices, setNotices] = React.useState([]);
  const [activeAudioSrc, setActiveAudioSrc] = React.useState("");
  const [previewAttachment, setPreviewAttachment] = React.useState(null);

  const shell = dark ? "darkShell text-white" : "glass text-slate-900";
  const border = dark ? "border-white/10" : "border-slate-900/10";

  const queueNotice = React.useCallback((textValue) => {
    const id = makeNoticeId();
    setNotices((prev) => [...prev, { id, text: textValue }]);
    window.setTimeout(() => {
      setNotices((prev) => prev.filter((notice) => notice.id !== id));
    }, 4200);
  }, []);

  const systemNotices = notices.slice(-2);

  return (
    <div className={`relative h-full overflow-hidden rounded-3xl ${shell}`}>
      <div className={`flex items-center justify-between border-b px-4 py-4 ${border}`}>
        <div className="flex items-center gap-3">
          <button className={dark ? "iconBtnDark" : "iconBtn"} aria-label="menu">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M4 6h16M4 12h16M4 18h16" stroke={dark ? "rgba(255,255,255,.8)" : "rgba(15,23,42,.75)"} strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <div>
            <div className="font-semibold">Chat</div>
            <div className={`text-[11px] ${dark ? "text-white/45" : "text-slate-500"}`}>
              Messages, mentions, and shared image attachments
            </div>
          </div>
        </div>
        <button className={dark ? "iconBtnDark" : "iconBtn"} aria-label="more">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M6 12h.01M12 12h.01M18 12h.01" stroke={dark ? "rgba(255,255,255,.8)" : "rgba(15,23,42,.75)"} strokeWidth="3" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="chat-scroll-area h-[calc(100%-198px)] space-y-3 overflow-auto p-4">
        {systemNotices.map((notice) => (
          <ChatSystemNotice key={notice.id} notice={notice} dark={dark} />
        ))}

        {messages.length === 0 ? (
          <div className={`text-sm ${dark ? "text-white/60" : "text-slate-600"}`}>No messages yet.</div>
        ) : (
          messages.map((message, idx) => {
            const name = message.name || message.display_name || message.from_display_name || message.from_uid || "User";
            const textValue = message.text || message.message || "";
            const incomingAttachments = (message.attachments || [])
              .map((attachment, attachmentIndex) => normalizeIncomingAttachment(attachment, attachmentIndex))
              .filter(Boolean);
            const audioSrc = message.audioUrl || message.audio_src || "";
            const mentionsMe = messageMentionsUser(message, currentUserId);

            return (
              <div
                key={`${message.sent_at || idx}-${message.from_uid || idx}`}
                className={
                  "flex items-start gap-3 rounded-[22px] border px-3 py-3 " +
                  (mentionsMe
                    ? dark
                      ? "border-[#5AB2F5]/25 bg-[#0F2434]"
                      : "border-[#0B5FA8]/15 bg-[#F5FAFF]"
                    : dark
                      ? "border-transparent bg-transparent"
                      : "border-transparent bg-transparent")
                }
              >
                <div
                  className={`grid h-10 w-10 place-items-center rounded-full font-bold ${
                    dark ? "bg-white/10 text-white" : "bg-[rgba(47,111,87,.18)] text-[rgba(47,111,87,.95)]"
                  }`}
                >
                  {name[0]?.toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className={`text-sm font-semibold ${dark ? "text-white" : "text-slate-900"}`}>{name}</div>
                    {mentionsMe ? (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${dark ? "bg-[#11314B] text-[#A8DEFF]" : "bg-[#EAF4FF] text-[#0B5FA8]"}`}>
                        Mentioned you
                      </span>
                    ) : null}
                  </div>
                  {textValue ? (
                    <div className="space-y-2">
                      <MessageBody dark={dark} text={textValue} mentions={message.mentions || []} />
                      {audioSrc ? (
                        <button
                          type="button"
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                            dark ? "border-white/10 bg-white/10 text-white/80" : "border-slate-900/10 bg-white text-slate-700"
                          }`}
                          onClick={() => setActiveAudioSrc(audioSrc)}
                        >
                          <span>Play audio</span>
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  {incomingAttachments.length ? (
                    <div className="mt-2 space-y-2">
                      <div className="flex flex-wrap gap-2">
                        {incomingAttachments.map((attachment) => (
                          <button
                            type="button"
                            key={attachment.id}
                            onClick={() => setPreviewAttachment(attachment)}
                            className={`overflow-hidden rounded-2xl border ${
                              dark ? "border-white/10 bg-white/[0.06]" : "border-slate-900/10 bg-white/80"
                            }`}
                          >
                            <SecureAttachmentImage attachment={attachment} alt={attachment.name} className="h-24 w-24 object-cover" />
                            <div className={`w-24 px-2 py-2 text-left ${dark ? "text-white/75" : "text-slate-600"}`}>
                              <div className="truncate text-[11px] font-semibold">{attachment.name}</div>
                              <div className="mt-1 text-[10px]">{formatAttachmentSize(attachment.size) || "Image"}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {incomingAttachments.map((attachment) => (
                          <button
                            type="button"
                            key={`${attachment.id}-open`}
                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                              dark ? "border-white/10 bg-white/10 text-white/80" : "border-slate-900/10 bg-white text-slate-700"
                            }`}
                            onClick={async () => {
                              try {
                                const blobUrl = await fetchAttachmentBlobUrl(attachment.id);
                                window.open(blobUrl, "_blank", "noopener,noreferrer");
                              } catch {
                                window.open(attachment.url, "_blank", "noopener,noreferrer");
                              }
                            }}
                          >
                            Open image
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className={`ml-auto text-xs ${dark ? "text-white/40" : "text-slate-400"}`}>{message.time || ""}</div>
              </div>
            );
          })
        )}
      </div>

      <div className={`border-t p-4 ${border}`}>
        <ConnectChatComposer
          value={text}
          onChange={setText}
          allowScreenshotSignals={allowScreenshotSignals}
          onSystemNotice={queueNotice}
          participants={participants}
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

            if (attachments.length) {
              if (!roomId) {
                queueNotice("This room is missing a shared attachment target.");
                return false;
              }

              for (const attachment of attachments) {
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
            }

            if (cleanText || uploadedAttachments.length) {
              await onSend?.({
                text: cleanText,
                mentions,
                attachments: uploadedAttachments,
              });
            }

            setText("");
            if (uploadedAttachments.length) {
              queueNotice(`Shared ${uploadedAttachments.length} image attachment${uploadedAttachments.length === 1 ? "" : "s"} with the room.`);
            }
            return true;
          }}
        />
      </div>

      <ConnectAudioOverlay src={activeAudioSrc} onClosed={() => setActiveAudioSrc("")} />
      <AttachmentPreviewModal attachment={previewAttachment} open={!!previewAttachment} onClose={() => setPreviewAttachment(null)} />
    </div>
  );
}
