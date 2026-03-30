import { auth } from "./firebase";
import { MEET_API_BASE, MEET_LOCAL_DEV_BYPASS } from "./meetConfig.js";

export const API_BASE = MEET_API_BASE;

export async function getIdToken() {
  const u = auth.currentUser;
  if (!u) return null;
  return await u.getIdToken();
}

export async function getRequiredIdToken(purpose = "this Meet action") {
  const token = await getIdToken();
  if (!token) {
    throw new Error(`A valid Meet sign-in is required for ${purpose}`);
  }
  return token;
}

async function meetRequest(path, options = {}) {
  const token = await getIdToken();
  const headers = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  } else if (MEET_LOCAL_DEV_BYPASS) {
    headers["X-Meet-Local-Dev-Bypass"] = "true";
  } else {
    throw new Error("Sign-in is required for this Meet action");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.detail || "Meet request failed");
  }

  return data;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const [, base64 = ""] = result.split(",", 2);
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error || new Error("Attachment read failed"));
    reader.readAsDataURL(file);
  });
}

export async function wsUrl(roomId, options = {}) {
  const token = await getRequiredIdToken("joining this meeting");
  const params = new URLSearchParams();
  params.set("token", token);
  if (options.sessionId) {
    params.set("session_id", options.sessionId);
  }
  const qs = params.toString();
  return `${API_BASE.replace("http", "ws")}/ws/rooms/${roomId}?${qs}`;
}

export async function fetchRtcConfig() {
  const token = await getRequiredIdToken("loading meeting network configuration");
  const response = await fetch(`${API_BASE}/api/auth/rtc-config`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.detail || "RTC configuration request failed");
  }
  return data;
}

export async function fetchAttachmentBlobUrl(attachmentId) {
  const token = await getIdToken();
  const headers = {};

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  } else if (MEET_LOCAL_DEV_BYPASS) {
    headers["X-Meet-Local-Dev-Bypass"] = "true";
  } else {
    throw new Error("Sign-in is required before opening this attachment");
  }

  const response = await fetch(`${API_BASE}/api/attachments/${attachmentId}`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.detail || "Attachment fetch failed");
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

export async function uploadChatAttachment(roomId, attachment) {
  if (!attachment?.file) {
    throw new Error("Missing attachment file");
  }

  const token = await getIdToken();
  const headers = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  } else if (MEET_LOCAL_DEV_BYPASS) {
    headers["X-Meet-Local-Dev-Bypass"] = "true";
  } else {
    throw new Error("Sign-in is required before uploading an attachment");
  }

  const response = await fetch(`${API_BASE}/api/attachments`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      room_id: roomId,
      name: attachment.name,
      content_type: attachment.type,
      data_base64: await fileToBase64(attachment.file),
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.detail || "Attachment upload failed");
  }

  return data;
}

export async function fetchScheduledMeetings() {
  return meetRequest("/api/scheduler/meetings");
}

export async function saveScheduledMeetingRecord(meeting) {
  return meetRequest("/api/scheduler/meetings", {
    method: "POST",
    body: meeting,
  });
}

export async function deleteScheduledMeetingRecord(meetingId) {
  return meetRequest(`/api/scheduler/meetings/${meetingId}`, {
    method: "DELETE",
  });
}

export async function fetchPersonalRoomRecord() {
  return meetRequest("/api/scheduler/personal-room");
}

export async function savePersonalRoomRecord(room) {
  return meetRequest("/api/scheduler/personal-room", {
    method: "PUT",
    body: room,
  });
}
