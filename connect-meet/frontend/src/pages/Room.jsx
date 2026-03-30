import React from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import ChatPanel from "../components/ChatPanel.jsx";
import MeetMobileRoom from "../components/mobile/MeetMobileRoom.jsx";
import ParticipantsPanel from "../components/ParticipantsPanel.jsx";
import BottomSheet from "../components/BottomSheet.jsx";
import MeetSettingsModal from "../components/MeetSettingsModal.jsx";
import MeetAiPanel from "../components/MeetAiPanel.jsx";
import { IconButton, LayoutPopover, MeetingInfoPanel, ReactionTray, Tile } from "../components/room/RoomSurfaceBits.jsx";
import { useIsMobile } from "../hooks/useIsMobile.js";
import { getCurrentUser, signOut, useAuth } from "../lib/auth";
import { fetchRtcConfig, wsUrl } from "../lib/api.js";
import { savePostMeetingContext } from "../lib/meetPostMeeting.js";
import { applyAnswer, applyOffer, bufferOrAddIce, clearBufferedIce, createPeer, flushIce, makeOffer } from "../lib/webrtc";
import { getDeviceLabel, listMeetDevices, playSpeakerTest, requestMeetMedia, resolveMeetPreferences, saveMeetPreferences } from "../lib/meetPreferences.js";

function formatChatTime(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function buildInitials(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (!parts.length) return "?";
  return parts.map((part) => part[0]?.toUpperCase() || "").join("");
}

export default function Room() {
  const defaultSecurity = React.useMemo(() => ({
    locked: false,
    mute_on_entry: false,
    allow_unmute: true,
  }), []);
  const { roomId } = useParams();
  const sessionStorageKey = React.useMemo(() => `elimulink-meet-session-${roomId}`, [roomId]);
  const nav = useNavigate();
  const loc = useLocation();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const wsRef = React.useRef(null);
  const localStreamRef = React.useRef(null);
  const peersRef = React.useRef(new Map());
  const presentingTrackRef = React.useRef(null);
  const reconnectTimerRef = React.useRef(null);
  const reconnectAttemptRef = React.useRef(0);
  const closingRef = React.useRef(false);
  const sessionIdRef = React.useRef("");
  const iceServersRef = React.useRef([{ urls: "stun:stun.l.google.com:19302" }]);
  const basePreferences = React.useMemo(() => resolveMeetPreferences(loc?.state), [loc?.state]);
  const preferencesRef = React.useRef(basePreferences);
  const [localStream, setLocalStream] = React.useState(null);
  const [remoteStreams, setRemoteStreams] = React.useState(new Map());
  const [members, setMembers] = React.useState([]);
  const [pending, setPending] = React.useState([]);
  const [hostUid, setHostUid] = React.useState(null);
  const [hostSessionId, setHostSessionId] = React.useState(null);
  const [admitted, setAdmitted] = React.useState(false);
  const [messages, setMessages] = React.useState([]);
  const [showChat, setShowChat] = React.useState(true);
  const [showPeople, setShowPeople] = React.useState(false);
  const [showAi, setShowAi] = React.useState(false);
  const [mobilePanel, setMobilePanel] = React.useState(false);
  const [infoOpen, setInfoOpen] = React.useState(false);
  const [layoutMenuOpen, setLayoutMenuOpen] = React.useState(false);
  const [layoutMode, setLayoutMode] = React.useState("grid");
  const [spotlightUid, setSpotlightUid] = React.useState("local");
  const [audioEnabled, setAudioEnabled] = React.useState(loc?.state?.mic ?? true);
  const [videoEnabled, setVideoEnabled] = React.useState(loc?.state?.cam ?? true);
  const [isPresenting, setIsPresenting] = React.useState(false);
  const [roomError, setRoomError] = React.useState("");
  const [preferences, setPreferences] = React.useState(basePreferences);
  const [devices, setDevices] = React.useState({ microphones: [], speakers: [], cameras: [] });
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [settingsTab, setSettingsTab] = React.useState("general");
  const [reactionTrayOpen, setReactionTrayOpen] = React.useState(false);
  const [reactionBursts, setReactionBursts] = React.useState([]);
  const [security, setSecurity] = React.useState(defaultSecurity);
  const [presentation, setPresentation] = React.useState({ active: false, presenter_uid: null, presenter_session_id: null, presenter_display_name: "", started_at: null });
  const myUid = React.useMemo(() => getCurrentUser()?.uid, []);
  const displayName = loc?.state?.name || user?.displayName || user?.email || "You";
  const roomTitle = loc?.state?.title || "Meet session";
  const memberMap = React.useMemo(() => new Map(members.map((member) => [member.uid, member])), [members]);
  const sessionMemberMap = React.useMemo(() => new Map(members.map((member) => [member.session_id, member])), [members]);
  const raisedHands = React.useMemo(() => members.filter((member) => member.hand_raised), [members]);
  const myHandRaised = React.useMemo(() => raisedHands.some((member) => member.session_id === sessionIdRef.current), [raisedHands]);
  const hostName = sessionMemberMap.get(hostSessionId)?.display_name || memberMap.get(hostUid)?.display_name || (hostUid === myUid ? displayName : hostUid) || "Unknown host";
  const activePresenterName = presentation.presenter_display_name || sessionMemberMap.get(presentation.presenter_session_id)?.display_name || memberMap.get(presentation.presenter_uid)?.display_name || "";
  const refreshDevices = React.useCallback(async () => { try { setDevices(await listMeetDevices()); } catch {} }, []);
  const changePreferences = React.useCallback((patch) => setPreferences((current) => ({ ...current, ...patch })), []);
  const stopLocalMedia = React.useCallback(() => {
    if (presentingTrackRef.current) {
      try { presentingTrackRef.current.stop(); } catch {}
    }
    presentingTrackRef.current = null;
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    localStreamRef.current = null;
    setLocalStream(null);
  }, []);
  const closePeerConnections = React.useCallback(() => {
    peersRef.current.forEach((pc) => pc.close());
    peersRef.current.clear();
    clearBufferedIce();
    setRemoteStreams(new Map());
  }, []);
  const ensureLocalMedia = React.useCallback(async ({ force = false } = {}) => {
    if (!force && localStreamRef.current && localStreamRef.current.getTracks().some((track) => track.readyState === "live")) {
      localStreamRef.current.getAudioTracks().forEach((track) => { track.enabled = audioEnabled; });
      localStreamRef.current.getVideoTracks().forEach((track) => { track.enabled = videoEnabled; });
      return localStreamRef.current;
    }

    const stream = await requestMeetMedia({
      selectedMicId: preferences.selectedMicId,
      selectedCameraId: preferences.selectedCameraId,
      audioEnabled: true,
      videoEnabled: true,
    });

    const previous = localStreamRef.current;
    localStreamRef.current = stream;
    stream.getAudioTracks().forEach((track) => { track.enabled = audioEnabled; });
    stream.getVideoTracks().forEach((track) => { track.enabled = videoEnabled; });
    setLocalStream(new MediaStream(stream.getTracks()));
    if (previous && previous !== stream) previous.getTracks().forEach((track) => track.stop());
    return stream;
  }, [audioEnabled, preferences.selectedCameraId, preferences.selectedMicId, videoEnabled]);
  const appendReactionBurst = React.useCallback((payload) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const burst = {
      id,
      emoji: payload.emoji,
      displayName: payload.displayName || "Participant",
      fromUid: payload.fromUid || "",
    };
    setReactionBursts((prev) => [...prev, burst]);
    window.setTimeout(() => {
      setReactionBursts((prev) => prev.filter((item) => item.id !== id));
    }, preferencesRef.current.reactionsAnimation ? 2200 : 1200);
  }, []);
  React.useEffect(() => { saveMeetPreferences(preferences); }, [preferences]);
  React.useEffect(() => { preferencesRef.current = preferences; }, [preferences]);
  React.useEffect(() => { refreshDevices(); }, [refreshDevices]);
  React.useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(sessionStorageKey);
      if (stored) sessionIdRef.current = stored;
    } catch {}
  }, [sessionStorageKey]);
  React.useEffect(() => {
    let active = true;
    fetchRtcConfig()
      .then((result) => {
        if (!active) return;
        if (Array.isArray(result?.ice_servers) && result.ice_servers.length) {
          iceServersRef.current = result.ice_servers;
        }
      })
      .catch((error) => {
        if (active && error?.message) {
          setRoomError(error.message);
        }
      });
    return () => {
      active = false;
    };
  }, []);
  React.useEffect(() => {
    if (isPresenting) return;
    let active = true;
    async function prepareStream() {
      try {
        const stream = await ensureLocalMedia();
        if (!active) { stream.getTracks().forEach((track) => track.stop()); return; }
        peersRef.current.forEach((pc) => {
          const audioTrack = stream.getAudioTracks()[0];
          const videoTrack = stream.getVideoTracks()[0];
          const audioSender = pc.getSenders().find((sender) => sender.track && sender.track.kind === "audio");
          const videoSender = pc.getSenders().find((sender) => sender.track && sender.track.kind === "video");
          if (audioSender && audioTrack) audioSender.replaceTrack(audioTrack);
          if (videoSender && videoTrack) videoSender.replaceTrack(videoTrack);
        });
        setRoomError("");
        await refreshDevices();
      } catch {
        setRoomError("Camera or microphone access failed. You can remain in the room, but local media may be unavailable.");
      }
    }
    prepareStream();
    return () => { active = false; };
  }, [ensureLocalMedia, isPresenting, refreshDevices]);
  React.useEffect(() => {
    if (spotlightUid !== "local" && !remoteStreams.has(spotlightUid)) setSpotlightUid("local");
  }, [remoteStreams, spotlightUid]);
  React.useEffect(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((track) => { track.enabled = audioEnabled; });
  }, [audioEnabled]);
  React.useEffect(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getVideoTracks().forEach((track) => { track.enabled = videoEnabled; });
  }, [videoEnabled]);
  React.useEffect(() => {
    if (!admitted) return;
    sendMessage({
      type: "media_state",
      payload: {
        audio_enabled: audioEnabled,
        video_enabled: videoEnabled,
      },
    });
  }, [admitted, audioEnabled, videoEnabled]);
  function sendMessage(msg) {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ room_id: roomId, ...msg }));
  }
  function ensurePeer(remoteSessionId) {
    if (!remoteSessionId) return null;
    if (peersRef.current.has(remoteSessionId)) return peersRef.current.get(remoteSessionId);
    if (!localStreamRef.current) return null;
    const pc = createPeer({
      localStream: localStreamRef.current,
      iceServers: iceServersRef.current,
      onIce: (candidate) => sendMessage({ type: "ice", to_session_id: remoteSessionId, payload: candidate }),
      onTrack: (stream) => {
        setRemoteStreams((prev) => {
          const next = new Map(prev);
          next.set(remoteSessionId, stream);
          return next;
        });
      },
    });
    peersRef.current.set(remoteSessionId, pc);
    return pc;
  }
  async function handlePresence(msg) {
    const nextMembers = msg.members || msg.participants || [];
    const nextPending = msg.pending || [];
    setMembers(nextMembers);
    setPending(nextPending);
    setHostUid(msg.host_uid);
    setHostSessionId(msg.host_session_id || null);
    setSecurity({ ...defaultSecurity, ...(msg.security || {}) });
    setPresentation({
      active: Boolean(msg.presentation?.active),
      presenter_uid: msg.presentation?.presenter_uid || null,
      presenter_session_id: msg.presentation?.presenter_session_id || null,
      presenter_display_name: msg.presentation?.presenter_display_name || "",
      started_at: msg.presentation?.started_at || null,
    });
    const inMembers = sessionIdRef.current
      ? nextMembers.some((member) => member.session_id === sessionIdRef.current)
      : nextMembers.some((member) => member.uid === myUid);
    setAdmitted(inMembers);
    if (msg.host_session_id === sessionIdRef.current && inMembers) {
      for (const member of nextMembers) {
        if (member.session_id === sessionIdRef.current || peersRef.current.has(member.session_id)) continue;
        const pc = ensurePeer(member.session_id);
        if (!pc) continue;
        const offer = await makeOffer(pc);
        sendMessage({ type: "offer", to_session_id: member.session_id, payload: offer });
      }
    }
  }
  React.useEffect(() => {
    let active = true;
    closingRef.current = false;
    async function connect() {
      const userNow = getCurrentUser();
      if (!userNow) { nav("/login"); return; }
      try {
        await ensureLocalMedia({ force: reconnectAttemptRef.current > 0 && !localStreamRef.current });
      } catch {
        setRoomError("We recovered your room session, but camera or microphone access still needs your permission to restore live media.");
      }

      let socketUrl = "";
      try {
        socketUrl = await wsUrl(roomId, { sessionId: sessionIdRef.current });
      } catch (error) {
        setRoomError(error?.message || "Your Meet sign-in is no longer valid. Please sign in again.");
        await signOut();
        nav("/login", { state: { returnTo: `/meet/${roomId}` }, replace: true });
        return;
      }
      const ws = new WebSocket(socketUrl);
      wsRef.current = ws;
      ws.onopen = () => {
        reconnectAttemptRef.current = 0;
        setRoomError("");
      };
      ws.onmessage = async (event) => {
        if (!active) return;
        const msg = JSON.parse(event.data);
        if (msg.type === "presence") return handlePresence(msg);
        if (msg.type === "hello") {
          if (msg.session_id) {
            sessionIdRef.current = msg.session_id;
            try {
              window.sessionStorage.setItem(sessionStorageKey, msg.session_id);
            } catch {}
          }
          setHostUid(msg.host_uid || null);
          setHostSessionId(msg.host_session_id || null);
          if (msg.presentation) {
            setPresentation({
              active: Boolean(msg.presentation?.active),
              presenter_uid: msg.presentation?.presenter_uid || null,
              presenter_session_id: msg.presentation?.presenter_session_id || null,
              presenter_display_name: msg.presentation?.presenter_display_name || "",
              started_at: msg.presentation?.started_at || null,
            });
          }
          return;
        }
        if (msg.type === "admitted") return setAdmitted(true);
        if (msg.type === "security_state") {
          setSecurity({ ...defaultSecurity, ...(msg.security || {}) });
          return;
        }
        if (msg.type === "presentation_state") {
          setPresentation({
            active: Boolean(msg.active),
            presenter_uid: msg.presenter_uid || null,
            presenter_session_id: msg.presenter_session_id || null,
            presenter_display_name: msg.presenter_display_name || "",
            started_at: msg.started_at || null,
          });
          return;
        }
        if (msg.type === "error") {
          if (msg.code === "invalid_target" || msg.code === "session_expired") {
            setRoomError(msg.detail || "The meeting connection needs to renegotiate.");
          }
          return;
        }
        if (msg.type === "meeting_locked") {
          setRoomError("The host has locked this meeting. New participants cannot join until it is unlocked.");
          nav("/");
          return;
        }
        if (msg.type === "offer") {
          const fromSessionId = msg.from_session_id;
          const fromUid = msg.from_uid;
          if (!fromSessionId || !fromUid || fromSessionId === sessionIdRef.current || hostSessionId === sessionIdRef.current) return;
          const pc = ensurePeer(fromSessionId);
          if (!pc) return;
          const answer = await applyOffer(pc, msg.payload);
          sendMessage({ type: "answer", to_session_id: fromSessionId, payload: answer });
          await flushIce(pc, fromSessionId);
          return;
        }
        if (msg.type === "answer") {
          const pc = peersRef.current.get(msg.from_session_id);
          if (!pc) return;
          await applyAnswer(pc, msg.payload);
          await flushIce(pc, msg.from_session_id);
          return;
        }
        if (msg.type === "ice") {
          const pc = ensurePeer(msg.from_session_id);
          if (!pc) return;
          await bufferOrAddIce(pc, msg.from_session_id, msg.payload);
          return;
        }
        if (msg.type === "chat_message") {
          setMessages((prev) => [...prev, {
            message: msg.message,
            from_uid: msg.from_uid,
            display_name: msg.from_display_name || msg.display_name || msg.from_uid,
            attachments: Array.isArray(msg.attachments) ? msg.attachments : [],
            mentions: Array.isArray(msg.mentions) ? msg.mentions : [],
            time: formatChatTime(msg.sent_at),
            sent_at: msg.sent_at,
          }]);
          return;
        }
        if (msg.type === "reaction") {
          if (preferencesRef.current.reactionsEnabled && msg.emoji) {
            appendReactionBurst({
              emoji: msg.emoji,
              displayName: msg.from_display_name || msg.from_uid || "Participant",
              fromUid: msg.from_uid,
            });
          }
          return;
        }
        if (msg.type === "mute_all") {
          if (msg.from_uid !== myUid) {
            const stream = localStreamRef.current;
            if (stream) {
              stream.getAudioTracks().forEach((track) => { track.enabled = false; });
            }
            setAudioEnabled(false);
            setRoomError(`${msg.from_display_name || "The host"} muted everyone in the room.`);
          }
          return;
        }
        if (msg.type === "raise_hand" || msg.type === "lower_hand") return;
        if (msg.type === "leave") {
          const fromSessionId = msg.from_session_id || msg.session_id;
          if (!fromSessionId) return;
          const pc = peersRef.current.get(fromSessionId);
          if (pc) pc.close();
          peersRef.current.delete(fromSessionId);
          clearBufferedIce(fromSessionId);
          setRemoteStreams((prev) => {
            const next = new Map(prev);
            next.delete(fromSessionId);
            return next;
          });
          return;
        }
        if (msg.type === "remove" || msg.type === "removed") {
          cleanup();
          nav("/");
          return;
        }
        if (msg.type === "host_assigned") {
          setHostUid(msg.host_uid || null);
          setHostSessionId(msg.host_session_id || null);
        }
      };
      ws.onclose = () => {
        closePeerConnections();
        wsRef.current = null;
        if (!active || closingRef.current) return;
        reconnectAttemptRef.current += 1;
        const delay = Math.min(1000 * reconnectAttemptRef.current, 5000);
        setRoomError("Connection dropped. Trying to recover your room session.");
        reconnectTimerRef.current = window.setTimeout(() => {
          if (active) connect();
        }, delay);
      };
    }
    connect();
    return () => {
      active = false;
      closingRef.current = true;
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
      cleanup();
    };
  }, [appendReactionBurst, closePeerConnections, defaultSecurity, ensureLocalMedia, hostSessionId, nav, roomId, sessionStorageKey]);
  function cleanup(sendLeave = true) {
    const ws = wsRef.current;
    if (sendLeave && ws && ws.readyState === WebSocket.OPEN) {
      closingRef.current = true;
      ws.send(JSON.stringify({ type: "leave", room_id: roomId }));
      ws.close();
    } else if (ws) {
      try { ws.close(); } catch {}
    }
    wsRef.current = null;
    closePeerConnections();
    stopLocalMedia();
  }
  function toggleTrack(kind) {
    const stream = localStreamRef.current;
    if (!stream) return;
    const tracks = kind === "audio" ? stream.getAudioTracks() : stream.getVideoTracks();
    const nextEnabled = !(tracks[0]?.enabled ?? true);
    if (kind === "audio" && nextEnabled && myUid !== hostUid && !security.allow_unmute) {
      setRoomError("The host has turned off attendee self-unmute for now.");
      return;
    }
    tracks.forEach((track) => { track.enabled = nextEnabled; });
    if (kind === "audio") setAudioEnabled(nextEnabled);
    if (kind === "video") setVideoEnabled(nextEnabled);
  }
  async function restoreCameraTrack(localStreamSnapshot) {
    try {
      const replacementStream = await requestMeetMedia({ selectedCameraId: preferences.selectedCameraId, audioEnabled: false, videoEnabled: true });
      const replacementTrack = replacementStream.getVideoTracks()[0];
      if (!replacementTrack || !localStreamSnapshot) {
        setIsPresenting(false);
        sendMessage({ type: "presentation_state", payload: { active: false } });
        return;
      }
      replacementTrack.enabled = videoEnabled;
      peersRef.current.forEach((pc) => {
        const sender = pc.getSenders().find((current) => current.track && current.track.kind === "video");
        if (sender) sender.replaceTrack(replacementTrack);
      });
      localStreamSnapshot.getVideoTracks().forEach((track) => localStreamSnapshot.removeTrack(track));
      localStreamSnapshot.addTrack(replacementTrack);
      localStreamRef.current = localStreamSnapshot;
      setLocalStream(new MediaStream(localStreamSnapshot.getTracks()));
      setIsPresenting(false);
      presentingTrackRef.current = null;
      sendMessage({ type: "presentation_state", payload: { active: false } });
    } catch {
      setIsPresenting(false);
      sendMessage({ type: "presentation_state", payload: { active: false } });
      setRoomError("Screen sharing ended, but the camera could not be restored automatically.");
    }
  }
  async function shareScreen() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = stream.getVideoTracks()[0];
      const local = localStreamRef.current;
      if (!local || !screenTrack) return;
      setIsPresenting(true);
      presentingTrackRef.current = screenTrack;
      peersRef.current.forEach((pc) => {
        const sender = pc.getSenders().find((current) => current.track && current.track.kind === "video");
        if (sender) sender.replaceTrack(screenTrack);
      });
      local.getVideoTracks().forEach((track) => local.removeTrack(track));
      local.addTrack(screenTrack);
      localStreamRef.current = local;
      setLocalStream(new MediaStream(local.getTracks()));
      sendMessage({ type: "presentation_state", payload: { active: true } });
      screenTrack.onended = () => restoreCameraTrack(local);
    } catch {
      setRoomError("Screen sharing was cancelled or blocked.");
    }
  }
  function stopPresenting() {
    if (presentingTrackRef.current) presentingTrackRef.current.stop();
    else {
      setIsPresenting(false);
      sendMessage({ type: "presentation_state", payload: { active: false } });
    }
  }
  function openPanel(type) {
    setShowPeople(type === "people");
    setShowAi(type === "ai");
    setShowChat(type === "chat");
    if (window.innerWidth < 1024) setMobilePanel(true);
  }
  function sendReaction(emoji) {
    if (!preferences.reactionsEnabled) {
      setRoomError("Reaction display is turned off in your settings.");
      return;
    }
    sendMessage({ type: "reaction", emoji });
    setReactionTrayOpen(false);
  }
  function toggleRaisedHand() {
    sendMessage({ type: myHandRaised ? "lower_hand" : "raise_hand" });
  }
  const sendSessionTargetedMessage = React.useCallback((type, person) => {
    const sessionId = person?.session_id || person?.sessionId || "";
    if (!sessionId) {
      setRoomError("That participant session is no longer available. Please wait for the room list to refresh.");
      return;
    }
    sendMessage({ type, to_session_id: sessionId });
  }, []);
  const leaveToPostMeeting = React.useCallback(() => {
    const postMeetingState = {
      roomId,
      title: roomTitle,
      name: displayName,
      mic: audioEnabled,
      cam: videoEnabled,
      source: loc?.state?.source || "room",
      selectedMicId: preferences.selectedMicId,
      selectedSpeakerId: preferences.selectedSpeakerId,
      selectedCameraId: preferences.selectedCameraId,
      leftAt: new Date().toISOString(),
    };
    savePostMeetingContext(postMeetingState);
    try {
      window.sessionStorage.removeItem(sessionStorageKey);
      sessionIdRef.current = "";
    } catch {}
    cleanup();
    nav(`/meet/${roomId}/left`, { state: postMeetingState });
  }, [audioEnabled, displayName, loc?.state?.source, nav, preferences.selectedCameraId, preferences.selectedMicId, preferences.selectedSpeakerId, roomId, roomTitle, sessionStorageKey, videoEnabled]);
  const setRoomSecurity = React.useCallback((patch) => {
    sendMessage({ type: "set_security", payload: patch });
  }, [roomId]);
  const muteAllParticipants = React.useCallback(() => {
    sendMessage({ type: "mute_all" });
    setRoomError("A room-wide mute request was sent to current participants.");
  }, [roomId]);
  React.useEffect(() => {
    if (sessionIdRef.current === hostSessionId || !security.mute_on_entry || !admitted) return;
    const stream = localStreamRef.current;
    if (stream) {
      stream.getAudioTracks().forEach((track) => { track.enabled = false; });
    }
    setAudioEnabled(false);
  }, [admitted, hostSessionId, security.mute_on_entry]);
  function attachMedia(node, stream, { muted = false } = {}) {
    if (!node || !stream) return;
    if (node.srcObject !== stream) node.srcObject = stream;
    if (!muted && typeof node.setSinkId === "function" && preferences.selectedSpeakerId) {
      node.setSinkId(preferences.selectedSpeakerId).catch(() => {});
    }
  }
  const remoteTiles = members
    .filter((member) => member.session_id !== sessionIdRef.current)
    .map((member) => {
    const uid = member.uid;
    const sessionId = member.session_id;
    const stream = remoteStreams.get(sessionId) || null;
    const subtitleParts = [];
    if (sessionId === hostSessionId) subtitleParts.push("Host");
    else subtitleParts.push("Participant");
    if (presentation.active && presentation.presenter_session_id === sessionId) subtitleParts.push("Presenting");
    if (member?.hand_raised) subtitleParts.push("Hand raised");
    return {
      uid: sessionId,
      memberUid: uid,
      sessionId,
      stream,
      title: member?.display_name || uid,
      subtitle: subtitleParts.join(" / "),
      audioEnabled: member?.audio_enabled !== false,
      videoEnabled: member?.video_enabled !== false,
      initials: buildInitials(member?.display_name || uid),
    };
  });
  const localSubtitle = [
    isPresenting || presentation.presenter_session_id === sessionIdRef.current ? "Presenting" : "You",
    myHandRaised ? "Hand raised" : null,
  ].filter(Boolean).join(" / ");
  const localTile = {
    uid: "local",
    title: displayName,
    subtitle: localSubtitle,
    stream: localStream,
    local: true,
    audioEnabled,
    videoEnabled,
    initials: buildInitials(displayName),
  };
  const spotlightTile = layoutMode === "spotlight" ? (spotlightUid === "local" ? localTile : remoteTiles.find((tile) => tile.uid === spotlightUid)) : null;
  const sideTiles = layoutMode === "spotlight" ? [...(spotlightUid === "local" ? [] : [localTile]), ...remoteTiles.filter((tile) => tile.uid !== spotlightUid)] : [];
  const effectClasses = preferences.backgroundEffect === "soft-blur" ? "scale-[1.02] blur-[1.2px]" : preferences.backgroundEffect === "warm" ? "sepia-[0.14] saturate-[1.08]" : preferences.backgroundEffect === "cool" ? "brightness-[0.98] hue-rotate-[10deg] saturate-[0.95]" : "";
  const currentMicLabel = getDeviceLabel(devices.microphones.find((device) => device.deviceId === preferences.selectedMicId), "System default microphone");
  const currentSpeakerLabel = getDeviceLabel(devices.speakers.find((device) => device.deviceId === preferences.selectedSpeakerId), "System default speaker");
  const currentCameraLabel = getDeviceLabel(devices.cameras.find((device) => device.deviceId === preferences.selectedCameraId), "System default camera");
  const isHost = sessionIdRef.current === hostSessionId;
  const microphoneOptions = [{ value: "", label: "System default microphone" }].concat(
    devices.microphones.map((device, index) => ({
      value: device.deviceId,
      label: getDeviceLabel(device, `Microphone ${index + 1}`),
    }))
  );
  const speakerOptions = [{ value: "", label: "System default speaker" }].concat(
    devices.speakers.map((device, index) => ({
      value: device.deviceId,
      label: getDeviceLabel(device, `Speaker ${index + 1}`),
    }))
  );
  const cameraOptions = [{ value: "", label: "System default camera" }].concat(
    devices.cameras.map((device, index) => ({
      value: device.deviceId,
      label: getDeviceLabel(device, `Camera ${index + 1}`),
    }))
  );

  if (isMobile) {
    return (
      <MeetMobileRoom
        roomTitle={roomTitle}
        roomId={roomId}
        displayName={displayName}
        hostName={hostName}
        presenterName={activePresenterName}
        presenterSessionId={presentation.active ? presentation.presenter_session_id : null}
        currentSessionId={sessionIdRef.current}
        hostSessionId={hostSessionId}
        members={members}
        pending={pending}
        hostUid={hostUid}
        myUid={myUid}
        isHost={isHost}
        admitted={admitted}
        localTile={localTile}
        remoteTiles={remoteTiles}
        spotlightTile={spotlightTile}
        sideTiles={sideTiles}
        localStream={localStream}
        isPresenting={isPresenting}
        roomError={roomError}
        audioEnabled={audioEnabled}
        videoEnabled={videoEnabled}
        myHandRaised={myHandRaised}
        preferences={preferences}
        messages={messages}
        reactionBursts={reactionBursts}
        reactionTrayOpen={reactionTrayOpen}
        microphoneOptions={microphoneOptions}
        speakerOptions={speakerOptions}
        cameraOptions={cameraOptions}
        changePreferences={changePreferences}
        attachMedia={attachMedia}
        sendReaction={sendReaction}
        onToggleReactionTray={() => setReactionTrayOpen((value) => !value)}
        toggleTrack={toggleTrack}
        toggleRaisedHand={toggleRaisedHand}
        shareScreen={shareScreen}
        stopPresenting={stopPresenting}
        leaveMeeting={leaveToPostMeeting}
        onSendChat={({ text, mentions, attachments }) => sendMessage({ type: "chat_message", message: text, mentions, attachments })}
        onAdmit={(person) => sendSessionTargetedMessage("admit", person)}
        onAdmitAll={() => pending.forEach((person) => sendSessionTargetedMessage("admit", person))}
        onRemove={(person) => sendSessionTargetedMessage("remove", person)}
        onLowerHand={(person) => sendSessionTargetedMessage("lower_hand", person)}
        onTransferHost={(person) => sendSessionTargetedMessage("transfer_host", person)}
        copyInviteLink={async () => {
          const link = `${window.location.origin}/meet/${roomId}`;
          try {
            await navigator.clipboard.writeText(link);
          } catch {
            window.prompt("Copy meeting link", link);
          }
        }}
        canShareScreen={typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getDisplayMedia)}
        testSpeaker={() => playSpeakerTest(preferences.selectedSpeakerId)}
      />
    );
  }
  return (
    <div className="min-h-screen bg-[#07111B] px-3 py-4 md:px-5 md:py-5">
      <MeetSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        activeTab={settingsTab}
        onChangeTab={setSettingsTab}
        preferences={preferences}
        onChangePreferences={changePreferences}
        devices={devices}
        currentMicLabel={currentMicLabel}
        currentSpeakerLabel={currentSpeakerLabel}
        currentCameraLabel={currentCameraLabel}
      />
      <div className="mx-auto max-w-[1380px]">
        <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(11,20,31,.96),rgba(3,9,17,.98))] shadow-[0_24px_70px_rgba(0,0,0,.32)]">
          <MeetingInfoPanel
            open={infoOpen}
            onClose={() => setInfoOpen(false)}
            roomId={roomId}
            roomTitle={roomTitle}
            hostName={hostName}
            memberCount={members.length}
            pendingCount={pending.length}
            security={security}
            isHost={isHost}
            onSetSecurity={setRoomSecurity}
            onMuteAll={muteAllParticipants}
          />
          <ReactionTray open={reactionTrayOpen} onReact={sendReaction} />
          <div className="pointer-events-none absolute inset-x-0 bottom-28 z-10 flex justify-end px-6">
            <div className="flex flex-col items-end gap-2">
              {reactionBursts.map((reaction, index) => (
                <div
                  key={reaction.id}
                  className={"rounded-[22px] border border-white/10 bg-white/[0.12] px-3 py-2 text-white shadow-[0_14px_28px_rgba(0,0,0,0.16)] " + (preferences.reactionsAnimation ? "animate-[floatUp_2.2s_ease-out_forwards]" : "")}
                  style={{ marginRight: `${index * 8}px` }}
                >
                  <div className="text-center text-xl leading-none">{reaction.emoji}</div>
                  <div className="mt-1 max-w-[92px] truncate text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-white/72">
                    {reaction.fromUid === myUid ? "You" : reaction.displayName}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4 border-b border-white/10 px-5 py-4">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Live meeting</div>
              <div className="mt-1 flex items-center gap-3"><h1 className="truncate text-lg font-semibold text-white">{roomTitle}</h1><span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-semibold text-white/70">{roomId}</span></div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-200">Secure room</div>
              {security.locked ? <div className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-amber-100">Locked</div> : null}
              {!security.allow_unmute ? <div className="rounded-full border border-slate-200/20 bg-white/[0.08] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-white/75">Host-only unmute</div> : null}
              {pending.length > 0 ? <div className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-amber-100">{pending.length} waiting</div> : null}
              {raisedHands.length > 0 ? <div className="rounded-full border border-sky-300/20 bg-sky-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-sky-100">{raisedHands.length} hand{raisedHands.length === 1 ? "" : "s"} raised</div> : null}
              <div className="relative">
                <IconButton label="Layout" onClick={() => setLayoutMenuOpen((value) => !value)} active={layoutMenuOpen}><svg width="19" height="19" viewBox="0 0 24 24" fill="none"><rect x="4" y="5" width="7" height="6" rx="1.8" stroke="currentColor" strokeWidth="1.9" /><rect x="13" y="5" width="7" height="6" rx="1.8" stroke="currentColor" strokeWidth="1.9" /><rect x="4" y="13" width="16" height="6" rx="1.8" stroke="currentColor" strokeWidth="1.9" /></svg></IconButton>
                {layoutMenuOpen ? <LayoutPopover value={layoutMode} onChange={(next) => { setLayoutMode(next); setLayoutMenuOpen(false); }} /> : null}
              </div>
              <IconButton label="Meeting info" onClick={() => setInfoOpen(true)} active={infoOpen}><svg width="19" height="19" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.9" /><path d="M12 11v5M12 8.2h.01" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" /></svg></IconButton>
              <IconButton label="Settings" onClick={() => { setSettingsTab("general"); setSettingsOpen(true); }} active={settingsOpen}><svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M12 9.25a2.75 2.75 0 1 0 0 5.5 2.75 2.75 0 0 0 0-5.5Z" stroke="currentColor" strokeWidth="1.9" /><path d="M19 12a7.2 7.2 0 0 0-.08-1.05l1.72-1.3-1.8-3.11-2.05.62a7.4 7.4 0 0 0-1.83-1.05l-.32-2.22H10.3l-.32 2.22c-.64.23-1.25.58-1.82 1.05l-2.06-.62L4.3 9.65l1.72 1.3A7.2 7.2 0 0 0 5.94 12c0 .36.03.71.08 1.05L4.3 14.35l1.8 3.11 2.06-.62c.57.47 1.18.82 1.82 1.05l.32 2.22h3.38l.32-2.22c.65-.23 1.26-.58 1.83-1.05l2.05.62 1.8-3.11-1.72-1.3c.05-.34.08-.69.08-1.05Z" stroke="currentColor" strokeWidth="1.65" strokeLinejoin="round" /></svg></IconButton>
              <button type="button" className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.08] font-bold text-white" title={displayName}>{(displayName[0] || "U").toUpperCase()}</button>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="relative p-4 md:p-5">
              {!admitted ? <div className="mb-4 rounded-[22px] border border-amber-300/15 bg-amber-300/10 px-4 py-3 text-sm text-amber-50">Waiting for host admission. You will move onto the main stage as soon as the host lets you in.</div> : null}
              {roomError ? <div className="mb-4 rounded-[22px] border border-red-300/15 bg-red-500/10 px-4 py-3 text-sm text-red-100">{roomError}</div> : null}
              {presentation.active ? <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-sky-300/20 bg-sky-300/10 px-4 py-3 text-sm text-sky-50"><div><div className="font-semibold">{presentation.presenter_session_id === sessionIdRef.current ? "You are presenting" : `${activePresenterName || "Someone"} is presenting`}</div><div className="mt-1 text-sky-100/80">{presentation.presenter_session_id === sessionIdRef.current ? "Your shared content is on stage. Stop presenting whenever you are ready." : "Presented content is currently prioritized on the main stage."}</div></div><div className="flex gap-2"><button type="button" className="rounded-full border border-white/10 bg-white/[0.08] px-3 py-2 text-xs font-semibold text-white" onClick={async () => { const link = `${window.location.origin}/meet/${roomId}`; try { await navigator.clipboard.writeText(link); } catch { window.prompt("Copy meeting link", link); } }}>Copy link</button>{presentation.presenter_session_id === sessionIdRef.current ? <button type="button" className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-slate-900" onClick={stopPresenting}>Stop presenting</button> : null}</div></div> : null}
              {preferences.captionsEnabled ? <div className="mb-4 rounded-[22px] border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white/80">Caption preferences are on. Live speech captions and transcript generation are not connected yet, but your language and styling choices are saved.</div> : null}
              {layoutMode === "spotlight" ? (
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
                  <Tile
                    title={spotlightTile?.title || displayName}
                    subtitle={spotlightTile?.subtitle}
                    large
                    active
                    cameraOff={spotlightTile?.videoEnabled === false}
                    micMuted={spotlightTile?.audioEnabled === false}
                    initials={spotlightTile?.initials || buildInitials(displayName)}
                  >
                    {spotlightTile?.local
                      ? <video autoPlay playsInline muted ref={(node) => attachMedia(node, localStream, { muted: true })} className={`h-full w-full object-cover ${effectClasses}`} />
                      : spotlightTile?.stream
                        ? <video autoPlay playsInline ref={(node) => attachMedia(node, spotlightTile.stream)} className="h-full w-full object-cover" />
                        : <div className="grid h-full place-items-center text-sm text-white/50">Remote media will appear when it is available.</div>}
                  </Tile>
                  <div className="space-y-4">
                    {sideTiles.map((tile) => (
                      <Tile
                        key={tile.uid}
                        title={tile.title}
                        subtitle={tile.subtitle}
                        onClick={() => setSpotlightUid(tile.uid)}
                        active={spotlightUid === tile.uid}
                        cameraOff={tile.videoEnabled === false}
                        micMuted={tile.audioEnabled === false}
                        initials={tile.initials}
                      >
                        {tile.local
                          ? <video autoPlay playsInline muted ref={(node) => attachMedia(node, localStream, { muted: true })} className={`h-full w-full object-cover ${effectClasses}`} />
                          : tile.stream
                            ? <video autoPlay playsInline ref={(node) => attachMedia(node, tile.stream)} className="h-full w-full object-cover" />
                            : <div className="grid h-full place-items-center text-sm text-white/50">Audio-only in room</div>}
                      </Tile>
                    ))}
                    {sideTiles.length === 0 ? <div className="rounded-[24px] border border-white/10 bg-white/[0.04] px-4 py-5 text-sm text-white/55">Remote participants will appear here when they join.</div> : null}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <Tile title={displayName} subtitle={localSubtitle} large={remoteTiles.length === 0} cameraOff={!videoEnabled} micMuted={!audioEnabled} initials={localTile.initials}>
                    <video autoPlay playsInline muted ref={(node) => attachMedia(node, localStream, { muted: true })} className={`h-full w-full object-cover ${effectClasses}`} />
                  </Tile>
                  {remoteTiles.map((tile) => (
                    <Tile key={tile.uid} title={tile.title} subtitle={tile.subtitle} cameraOff={!tile.videoEnabled} micMuted={!tile.audioEnabled} initials={tile.initials}>
                      {tile.stream ? <video autoPlay playsInline ref={(node) => attachMedia(node, tile.stream)} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-sm text-white/50">Audio-only in room</div>}
                    </Tile>
                  ))}
                </div>
              )}
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                <IconButton label={audioEnabled ? "Mute microphone" : "Unmute microphone"} onClick={() => toggleTrack("audio")} active={audioEnabled}><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 15.75A3.75 3.75 0 0 0 15.75 12V8a3.75 3.75 0 1 0-7.5 0v4A3.75 3.75 0 0 0 12 15.75Z" stroke="currentColor" strokeWidth="1.9" /><path d="M5.75 11.75a6.25 6.25 0 0 0 12.5 0M12 18.25V20.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" /></svg></IconButton>
                <IconButton label={videoEnabled ? "Turn camera off" : "Turn camera on"} onClick={() => toggleTrack("video")} active={videoEnabled}><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="4.25" y="7" width="11.25" height="10" rx="2.6" stroke="currentColor" strokeWidth="1.9" /><path d="M15.5 10.15 19.75 7.5v9l-4.25-2.65" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" /></svg></IconButton>
                <IconButton label={preferences.captionsEnabled ? "Turn caption preferences off" : "Turn caption preferences on"} onClick={() => changePreferences({ captionsEnabled: !preferences.captionsEnabled })} active={preferences.captionsEnabled}><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="4" y="5.75" width="16" height="12.5" rx="2.4" stroke="currentColor" strokeWidth="1.9" /><path d="M8 10.25h8M8 13.75h5.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" /></svg></IconButton>
                <IconButton label="Reactions" onClick={() => setReactionTrayOpen((value) => !value)} active={reactionTrayOpen}><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.9" /><path d="M8.75 13.8c.85 1.15 1.95 1.7 3.25 1.7s2.4-.55 3.25-1.7M9.2 10h.01M14.8 10h.01" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" /></svg></IconButton>
                <IconButton label="Share screen" onClick={shareScreen} active={isPresenting}><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3.5" y="5" width="17" height="10.5" rx="2.2" stroke="currentColor" strokeWidth="1.9" /><path d="M9 19h6M12 15.5V19M12 8.7v4.1M10.15 10.6 12 8.7l1.85 1.9" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg></IconButton>
                <IconButton label={myHandRaised ? "Lower hand" : "Raise hand"} onClick={toggleRaisedHand} active={myHandRaised}><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M8.2 11.1V5.85a1.35 1.35 0 1 1 2.7 0V10M10.9 10V4.9a1.35 1.35 0 1 1 2.7 0V10M13.6 10V5.5a1.35 1.35 0 1 1 2.7 0v7.2a4.9 4.9 0 0 1-9.8 0V9.9a1.3 1.3 0 1 1 2.6 0v1.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></IconButton>
                <IconButton label="Open chat" onClick={() => openPanel("chat")} active={showChat}><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M7.25 17.5 4 19.75V7a2.75 2.75 0 0 1 2.75-2.75h10.5A2.75 2.75 0 0 1 20 7v7A2.75 2.75 0 0 1 17.25 16.75h-10Z" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" /></svg></IconButton>
                <IconButton label="Open people panel" onClick={() => openPanel("people")} active={showPeople}><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 11a3.25 3.25 0 1 0 0-6.5A3.25 3.25 0 0 0 12 11ZM5.5 19.75a6.5 6.5 0 0 1 13 0" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" /></svg></IconButton>
                <IconButton label="Open AI panel" onClick={() => openPanel("ai")} active={showAi}><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3.4" stroke="currentColor" strokeWidth="1.9" /><path d="M12 4.5v2.25M12 17.25v2.25M4.5 12h2.25M17.25 12h2.25M6.7 6.7l1.6 1.6M15.7 15.7l1.6 1.6M17.3 6.7l-1.6 1.6M8.3 15.7l-1.6 1.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg></IconButton>
                <IconButton label="Open settings" onClick={() => { setSettingsTab("audio"); setSettingsOpen(true); }} active={settingsOpen}><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 9.25a2.75 2.75 0 1 0 0 5.5 2.75 2.75 0 0 0 0-5.5Z" stroke="currentColor" strokeWidth="1.9" /><path d="M19 12a7.2 7.2 0 0 0-.08-1.05l1.72-1.3-1.8-3.11-2.05.62a7.4 7.4 0 0 0-1.83-1.05l-.32-2.22H10.3l-.32 2.22c-.64.23-1.25.58-1.82 1.05l-2.06-.62L4.3 9.65l1.72 1.3A7.2 7.2 0 0 0 5.94 12c0 .36.03.71.08 1.05L4.3 14.35l1.8 3.11 2.06-.62c.57.47 1.18.82 1.82 1.05l.32 2.22h3.38l.32-2.22c.65-.23 1.26-.58 1.83-1.05l2.05.62 1.8-3.11-1.72-1.3c.05-.34.08-.69.08-1.05Z" stroke="currentColor" strokeWidth="1.65" strokeLinejoin="round" /></svg></IconButton>
                <IconButton label="Leave meeting" danger onClick={leaveToPostMeeting}><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M8.5 12h6.25M16.5 9.5l3 2.5-3 2.5" stroke="currentColor" strokeWidth="1.95" strokeLinecap="round" strokeLinejoin="round" /><path d="M14.5 5.25H9A3.75 3.75 0 0 0 5.25 9v6A3.75 3.75 0 0 0 9 18.75h5.5" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" /></svg></IconButton>
              </div>
            </div>
            <div className="hidden border-l border-white/10 p-4 md:p-5 lg:block">
              {showPeople ? <ParticipantsPanel dark members={members} pending={pending} hostUid={hostUid} hostSessionId={hostSessionId} myUid={myUid} currentSessionId={sessionIdRef.current} raisedHandCount={raisedHands.length} security={security} onAdmit={(person) => sendSessionTargetedMessage("admit", person)} onAdmitAll={() => pending.forEach((person) => sendSessionTargetedMessage("admit", person))} onRemove={(person) => sendSessionTargetedMessage("remove", person)} onDeny={(person) => sendSessionTargetedMessage("remove", person)} onLowerHand={(person) => sendSessionTargetedMessage("lower_hand", person)} onTransferHost={(person) => sendSessionTargetedMessage("transfer_host", person)} onToggleLock={() => setRoomSecurity({ locked: !security.locked })} onToggleMuteOnEntry={() => setRoomSecurity({ mute_on_entry: !security.mute_on_entry })} onToggleAllowUnmute={() => setRoomSecurity({ allow_unmute: !security.allow_unmute })} onMuteAll={muteAllParticipants} /> : showAi ? <MeetAiPanel dark roomId={roomId} roomTitle={roomTitle} members={members} messages={messages} hostName={hostName} /> : <ChatPanel dark roomId={roomId} messages={messages} participants={members} currentUserId={myUid} allowScreenshotSignals={!mobilePanel && !showPeople && !showAi} onSend={({ text, mentions, attachments }) => sendMessage({ type: "chat_message", message: text, mentions, attachments })} />}
            </div>
          </div>
        </div>
        <BottomSheet open={mobilePanel} onClose={() => setMobilePanel(false)}>
          <div className="mb-3 flex gap-2">
            <button className={`pill ${showChat ? "bg-[rgba(47,111,87,.16)] text-[rgba(47,111,87,.95)]" : ""}`} onClick={() => openPanel("chat")}>Chat</button>
            <button className={`pill ${showPeople ? "bg-[rgba(47,111,87,.16)] text-[rgba(47,111,87,.95)]" : ""}`} onClick={() => openPanel("people")}>Participants</button>
            <button className={`pill ${showAi ? "bg-[rgba(47,111,87,.16)] text-[rgba(47,111,87,.95)]" : ""}`} onClick={() => openPanel("ai")}>AI</button>
          </div>
          <div className="h-[420px]">
            {showPeople ? <ParticipantsPanel dark members={members} pending={pending} hostUid={hostUid} hostSessionId={hostSessionId} myUid={myUid} currentSessionId={sessionIdRef.current} raisedHandCount={raisedHands.length} security={security} onAdmit={(person) => sendSessionTargetedMessage("admit", person)} onAdmitAll={() => pending.forEach((person) => sendSessionTargetedMessage("admit", person))} onRemove={(person) => sendSessionTargetedMessage("remove", person)} onDeny={(person) => sendSessionTargetedMessage("remove", person)} onLowerHand={(person) => sendSessionTargetedMessage("lower_hand", person)} onTransferHost={(person) => sendSessionTargetedMessage("transfer_host", person)} onToggleLock={() => setRoomSecurity({ locked: !security.locked })} onToggleMuteOnEntry={() => setRoomSecurity({ mute_on_entry: !security.mute_on_entry })} onToggleAllowUnmute={() => setRoomSecurity({ allow_unmute: !security.allow_unmute })} onMuteAll={muteAllParticipants} /> : showAi ? <MeetAiPanel dark roomId={roomId} roomTitle={roomTitle} members={members} messages={messages} hostName={hostName} /> : <ChatPanel dark roomId={roomId} messages={messages} participants={members} currentUserId={myUid} allowScreenshotSignals={mobilePanel && showChat} onSend={({ text, mentions, attachments }) => sendMessage({ type: "chat_message", message: text, mentions, attachments })} />}
          </div>
        </BottomSheet>
      </div>
    </div>
  );
}
