const params = new URLSearchParams(location.search);
const roomId = params.get('room');
const token = params.get('token');
const signalingUrl = params.get('signal');

const statusEl = document.querySelector('#status');
const roomLabel = document.querySelector('#roomLabel');
const sentCountEl = document.querySelector('#sentCount');
const cameraInput = document.querySelector('#camera');
const cameraButton = document.querySelector('#cameraButton');
const hint = document.querySelector('#hint');
const previewCard = document.querySelector('#previewCard');
const previewEl = document.querySelector('#preview');
const cancelButton = document.querySelector('#cancelButton');
const sendButton = document.querySelector('#sendButton');
const progressEl = document.querySelector('#progress');

const CHUNK_SIZE = 16 * 1024;
const MAX_BUFFERED_AMOUNT = 256 * 1024;
const MAX_LONG_SIDE = 2200;
const JPEG_QUALITY = 0.82;

let ws = null;
let pc = null;
let channel = null;
let pendingIceCandidates = [];
let currentPhoto = null;
let currentPreviewUrl = null;
let sentCount = 0;

if (!roomId || !token || !signalingUrl) {
  setStatus('Enlace incompleto');
  hint.textContent = 'Vuelve a escanear el QR mostrado en la presentación.';
} else {
  roomLabel.textContent = `Sala ${roomId}`;
  connectSignaling();
}

cameraButton.addEventListener('click', () => cameraInput.click());
cameraInput.addEventListener('change', async () => {
  const file = cameraInput.files?.[0];
  cameraInput.value = '';
  if (!file) return;

  try {
    setStatus('Preparando foto…');
    currentPhoto = await preparePhoto(file);
    showPreview(currentPhoto.blob);
    setStatus(channel?.readyState === 'open' ? 'Conectado' : 'Esperando WebRTC…');
  } catch (error) {
    console.error(error);
    setStatus('No se pudo preparar la foto');
  }
});

cancelButton.addEventListener('click', clearCurrentPhoto);
sendButton.addEventListener('click', async () => {
  if (!currentPhoto || channel?.readyState !== 'open') return;
  try {
    setSending(true);
    await sendPhoto(currentPhoto);
    sentCount += 1;
    sentCountEl.textContent = `${sentCount} ${sentCount === 1 ? 'foto enviada' : 'fotos enviadas'}`;
    clearCurrentPhoto();
    setStatus('Conectado');
  } catch (error) {
    console.error(error);
    setStatus('Error al enviar');
  } finally {
    setSending(false);
  }
});

window.addEventListener('beforeunload', () => {
  try { channel?.close(); } catch {}
  try { pc?.close(); } catch {}
  try { ws?.close(); } catch {}
  revokePreview();
});

function connectSignaling() {
  setStatus('Conectando…');
  ws = new WebSocket(signalingUrl);

  ws.addEventListener('open', () => {
    sendWs({ type: 'mobile:join', roomId, token });
  });

  ws.addEventListener('message', async (event) => {
    let message;
    try { message = JSON.parse(event.data); } catch { return; }

    try {
      switch (message.type) {
        case 'room:joined':
          setStatus('Esperando WebRTC…');
          await createPeerConnection(message.iceServers || []);
          break;
        case 'signal':
          await handleSignal(message.data);
          break;
        case 'peer:left':
          setStatus('Presentación desconectada');
          cameraButton.disabled = true;
          closePeerConnection();
          break;
        case 'error':
          setStatus(`Error: ${message.message || 'desconocido'}`);
          break;
      }
    } catch (error) {
      console.error(error);
      setStatus('Error de conexión');
    }
  });

  ws.addEventListener('close', () => {
    cameraButton.disabled = true;
    closePeerConnection();
    setStatus('Servidor desconectado');
  });

  ws.addEventListener('error', () => setStatus('No se pudo conectar'));
}

async function createPeerConnection(iceServers) {
  closePeerConnection();
  pendingIceCandidates = [];
  pc = new RTCPeerConnection({ iceServers });

  pc.addEventListener('icecandidate', (event) => {
    if (!event.candidate) return;
    sendWs({
      type: 'signal',
      roomId,
      data: { type: 'candidate', candidate: event.candidate },
    });
  });

  pc.addEventListener('datachannel', (event) => configureDataChannel(event.channel));

  pc.addEventListener('connectionstatechange', () => {
    if (!pc) return;
    if (pc.connectionState === 'connected') setStatus('Conectado');
    if (pc.connectionState === 'failed') setStatus('Falló WebRTC');
    if (pc.connectionState === 'disconnected') setStatus('Conexión interrumpida');
  });
}

async function handleSignal(data) {
  if (!data) return;

  if (data.type === 'offer') {
    if (!pc) await createPeerConnection([]);
    await pc.setRemoteDescription(data.sdp);
    for (const candidate of pendingIceCandidates) await pc.addIceCandidate(candidate);
    pendingIceCandidates = [];

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    sendWs({
      type: 'signal',
      roomId,
      data: { type: 'answer', sdp: pc.localDescription },
    });
    return;
  }

  if (data.type === 'candidate') {
    if (!pc) return;
    if (pc.remoteDescription) await pc.addIceCandidate(data.candidate);
    else pendingIceCandidates.push(data.candidate);
  }
}

function configureDataChannel(dc) {
  channel = dc;
  channel.binaryType = 'arraybuffer';
  channel.bufferedAmountLowThreshold = 64 * 1024;

  channel.addEventListener('open', () => {
    setStatus('Conectado');
    cameraButton.disabled = false;
    hint.textContent = 'Haz una foto y envíala. No se guarda en el servidor.';
  });

  channel.addEventListener('close', () => {
    cameraButton.disabled = true;
    setStatus('WebRTC desconectado');
  });
}

async function preparePhoto(file) {
  const image = await loadImage(file);
  const scale = Math.min(1, MAX_LONG_SIDE / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.drawImage(image.source, 0, 0, width, height);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => result ? resolve(result) : reject(new Error('canvas.toBlob failed')), 'image/jpeg', JPEG_QUALITY);
  });

  image.cleanup?.();
  return {
    id: crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    blob,
    width,
    height,
  };
}

async function loadImage(file) {
  if ('createImageBitmap' in window) {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, cleanup: () => bitmap.close() };
    } catch {}
  }

  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  await img.decode();
  return { source: img, width: img.naturalWidth, height: img.naturalHeight, cleanup: () => URL.revokeObjectURL(url) };
}

async function sendPhoto(photo) {
  const buffer = await photo.blob.arrayBuffer();
  channel.send(JSON.stringify({
    type: 'photo:start',
    id: photo.id,
    mimeType: photo.blob.type || 'image/jpeg',
    width: photo.width,
    height: photo.height,
    size: buffer.byteLength,
  }));

  progressEl.max = buffer.byteLength;
  progressEl.value = 0;
  progressEl.classList.remove('hidden');

  for (let offset = 0; offset < buffer.byteLength; offset += CHUNK_SIZE) {
    await waitForBackpressure();
    const end = Math.min(offset + CHUNK_SIZE, buffer.byteLength);
    channel.send(buffer.slice(offset, end));
    progressEl.value = end;
  }

  channel.send(JSON.stringify({ type: 'photo:end', id: photo.id }));
}

async function waitForBackpressure() {
  if (channel.bufferedAmount <= MAX_BUFFERED_AMOUNT) return;
  await new Promise((resolve, reject) => {
    const onLow = () => { cleanup(); resolve(); };
    const onClose = () => { cleanup(); reject(new Error('DataChannel closed')); };
    const cleanup = () => {
      channel.removeEventListener('bufferedamountlow', onLow);
      channel.removeEventListener('close', onClose);
    };
    channel.addEventListener('bufferedamountlow', onLow, { once: true });
    channel.addEventListener('close', onClose, { once: true });
  });
}

function showPreview(blob) {
  revokePreview();
  currentPreviewUrl = URL.createObjectURL(blob);
  previewEl.src = currentPreviewUrl;
  previewCard.classList.remove('hidden');
}

function clearCurrentPhoto() {
  currentPhoto = null;
  revokePreview();
  previewEl.removeAttribute('src');
  previewCard.classList.add('hidden');
  progressEl.classList.add('hidden');
  progressEl.value = 0;
}

function revokePreview() {
  if (currentPreviewUrl) URL.revokeObjectURL(currentPreviewUrl);
  currentPreviewUrl = null;
}

function setSending(value) {
  sendButton.disabled = value;
  cancelButton.disabled = value;
  cameraButton.disabled = value || channel?.readyState !== 'open';
  if (value) setStatus('Enviando…');
  else progressEl.classList.add('hidden');
}

function closePeerConnection() {
  try { channel?.close(); } catch {}
  try { pc?.close(); } catch {}
  channel = null;
  pc = null;
  pendingIceCandidates = [];
}

function sendWs(data) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
}

function setStatus(text) { statusEl.textContent = text; }
