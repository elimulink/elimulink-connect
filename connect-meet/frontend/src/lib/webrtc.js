const iceBuffer = new Map();

export function createPeer({ localStream, onIce, onTrack }) {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });

  localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

  pc.onicecandidate = (e) => {
    if (e.candidate) onIce(e.candidate);
  };

  pc.ontrack = (e) => {
    if (e.streams && e.streams[0]) onTrack(e.streams[0]);
  };

  return pc;
}

export async function makeOffer(pc) {
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  return pc.localDescription;
}

export async function applyAnswer(pc, answer) {
  await pc.setRemoteDescription(new RTCSessionDescription(answer));
}

export async function applyOffer(pc, offer) {
  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  return pc.localDescription;
}

export async function bufferOrAddIce(pc, remoteUid, candidate) {
  if (!pc.remoteDescription) {
    const list = iceBuffer.get(remoteUid) || [];
    list.push(candidate);
    iceBuffer.set(remoteUid, list);
    return;
  }
  await pc.addIceCandidate(new RTCIceCandidate(candidate));
}

export async function flushIce(pc, remoteUid) {
  const list = iceBuffer.get(remoteUid) || [];
  for (const c of list) {
    await pc.addIceCandidate(new RTCIceCandidate(c));
  }
  iceBuffer.delete(remoteUid);
}