/**
 * reveal-live-photo
 * Reveal.js plugin for receiving temporary classroom photos over WebRTC.
 */
export default function createRevealLivePhoto(userConfig = {}) {
  const config = {
    signalingUrl: null,
    mobileUrl: null,
    qrEndpoint: null,
    key: 'P',
    autoShow: true,
    maxPhotos: 10,
    autoLoadCss: true,
    ...userConfig,
  };

  let deck = null;
  let ws = null;
  let pc = null;
  let channel = null;
  let roomId = null;
  let joinToken = null;
  let iceServers = [];
  let pendingIceCandidates = [];
  let currentTransfer = null;
  let photos = [];
  let photoIndex = -1;
  let qrObjectUrl = null;

  let overlay = null;
  let pairingElement = null;
  let viewerElement = null;
  let imageElement = null;
  let statusElement = null;
  let counterElement = null;

  let zoom = 1;
  let rotation = 0;
  let translateX = 0;
  let translateY = 0;
  let dragging = false;
  let dragStart = null;

  const plugin = {
    id: 'live-photo',

    init(revealDeck) {
      if (!config.signalingUrl || !config.mobileUrl) {
        throw new Error('RevealLivePhoto requires signalingUrl and mobileUrl');
      }

      deck = revealDeck;
      if (config.autoLoadCss) ensureStylesheet();
      createUI();

      deck.addKeyBinding(
        {
          keyCode: config.key.toUpperCase().charCodeAt(0),
          key: config.key,
          description: 'Fotos en directo',
        },
        toggle,
      );

      document.addEventListener('keydown', handleKeyboard, true);
      window.addEventListener('reveal-live-photo:toggle', handleToggleEvent);
    },

    destroy() {
      document.removeEventListener('keydown', handleKeyboard, true);
      window.removeEventListener('reveal-live-photo:toggle', handleToggleEvent);
      disconnect();
      clearPhotos();
      revokeQrObjectUrl();
      overlay?.remove();
      deck = null;
    },

    show,
    hide,
    toggle,
    connect,
    disconnect,
    clearPhotos,
    getPhotos: () => [...photos],
    getRoomId: () => roomId,
    isConnected: () => channel?.readyState === 'open',
  };


  function ensureStylesheet() {
    const id = 'reveal-live-photo-styles';
    if (document.getElementById(id)) return;

    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = new URL('./live-photo.css', import.meta.url).href;
    document.head.appendChild(link);
  }

  function handleToggleEvent() {
    toggle();
  }

  function createUI() {
    overlay = document.createElement('div');
    overlay.className = 'live-photo-overlay live-photo-hidden';
    overlay.innerHTML = `
      <div class="live-photo-topbar">
        <div class="live-photo-status">Desconectado</div>
        <button class="live-photo-icon-button" data-action="close" aria-label="Cerrar">×</button>
      </div>

      <section class="live-photo-pairing">
        <h2>Conectar móvil</h2>
        <p class="live-photo-help">Escanea el QR una vez al comenzar la clase.</p>
        <div class="live-photo-qr-wrap">
          <div class="live-photo-qr-placeholder">Preparando QR…</div>
          <img class="live-photo-qr live-photo-hidden" alt="QR para conectar el móvil">
        </div>
        <div class="live-photo-room"></div>
        <div class="live-photo-pair-url"></div>
      </section>

      <section class="live-photo-viewer live-photo-hidden">
        <div class="live-photo-canvas">
          <img class="live-photo-image" draggable="false" alt="Fotografía recibida">
        </div>
        <div class="live-photo-toolbar">
          <button data-action="prev" title="Anterior">‹</button>
          <span class="live-photo-counter">0 / 0</span>
          <button data-action="next" title="Siguiente">›</button>
          <button data-action="zoom-out" title="Alejar">−</button>
          <button data-action="zoom-in" title="Acercar">+</button>
          <button data-action="rotate" title="Rotar">↻</button>
          <button data-action="reset" title="Restablecer">1:1</button>
          <button data-action="delete" title="Eliminar foto actual">⌫</button>
        </div>
      </section>
    `;

    const viewport = deck.getViewportElement?.() || document.body;
    viewport.appendChild(overlay);

    pairingElement = overlay.querySelector('.live-photo-pairing');
    viewerElement = overlay.querySelector('.live-photo-viewer');
    imageElement = overlay.querySelector('.live-photo-image');
    statusElement = overlay.querySelector('.live-photo-status');
    counterElement = overlay.querySelector('.live-photo-counter');

    overlay.addEventListener('click', (event) => {
      const action = event.target.closest('[data-action]')?.dataset.action;
      if (!action) return;

      switch (action) {
        case 'close': hide(); break;
        case 'prev': previousPhoto(); break;
        case 'next': nextPhoto(); break;
        case 'zoom-out': setZoom(zoom - 0.25); break;
        case 'zoom-in': setZoom(zoom + 0.25); break;
        case 'rotate': rotation = (rotation + 90) % 360; updateTransform(); break;
        case 'reset': resetTransform(); break;
        case 'delete': deleteCurrentPhoto(); break;
      }
    });

    const canvas = overlay.querySelector('.live-photo-canvas');
    canvas.addEventListener('wheel', (event) => {
      if (viewerElement.classList.contains('live-photo-hidden')) return;
      event.preventDefault();
      setZoom(zoom + (event.deltaY < 0 ? 0.15 : -0.15));
    }, { passive: false });

    canvas.addEventListener('pointerdown', (event) => {
      if (zoom <= 1) return;
      dragging = true;
      canvas.setPointerCapture(event.pointerId);
      dragStart = { x: event.clientX - translateX, y: event.clientY - translateY };
    });

    canvas.addEventListener('pointermove', (event) => {
      if (!dragging || !dragStart) return;
      translateX = event.clientX - dragStart.x;
      translateY = event.clientY - dragStart.y;
      updateTransform();
    });

    const stopDragging = () => {
      dragging = false;
      dragStart = null;
    };
    canvas.addEventListener('pointerup', stopDragging);
    canvas.addEventListener('pointercancel', stopDragging);
  }

  function toggle() {
    if (overlay.classList.contains('live-photo-hidden')) {
      show();
      if (!ws) connect();
    } else {
      hide();
    }
  }

  function show() {
    overlay.classList.remove('live-photo-hidden');
  }

  function hide() {
    overlay.classList.add('live-photo-hidden');
  }

  function connect() {
    if (ws && [WebSocket.CONNECTING, WebSocket.OPEN].includes(ws.readyState)) return;

    setStatus('Conectando al servidor…');
    ws = new WebSocket(config.signalingUrl);

    ws.addEventListener('open', () => {
      sendWs({ type: 'presenter:create' });
    });

    ws.addEventListener('message', async (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }

      try {
        switch (message.type) {
          case 'room:created':
            roomId = message.roomId;
            joinToken = message.joinToken;
            iceServers = message.iceServers || [];
            setStatus('Esperando móvil');
            await showPairing(roomId, joinToken);
            break;

          case 'peer:joined':
            setStatus('Conectando por WebRTC…');
            await createPeerConnection();
            break;

          case 'signal':
            await handleSignal(message.data);
            break;

          case 'peer:left':
            setStatus('Móvil desconectado');
            closePeerConnection();
            showPairing(roomId, joinToken);
            break;

          case 'error':
            setStatus(`Error: ${message.message || 'desconocido'}`);
            break;
        }
      } catch (error) {
        console.error('[reveal-live-photo]', error);
        setStatus('Error de conexión');
      }
    });

    ws.addEventListener('close', () => {
      ws = null;
      closePeerConnection();
      setStatus('Servidor de señalización desconectado');
    });

    ws.addEventListener('error', () => {
      setStatus('No se pudo conectar al servidor');
    });
  }

  function disconnect() {
    closePeerConnection();
    if (ws) {
      ws.close();
      ws = null;
    }
    roomId = null;
    joinToken = null;
    iceServers = [];
    setStatus('Desconectado');
  }

  function sendWs(data) {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  async function showPairing(room, token) {
    if (!room || !token) return;

    viewerElement.classList.add('live-photo-hidden');
    pairingElement.classList.remove('live-photo-hidden');

    const pairUrl = new URL(config.mobileUrl, window.location.href);
    pairUrl.searchParams.set('room', room);
    pairUrl.searchParams.set('token', token);
    pairUrl.searchParams.set('signal', config.signalingUrl);

    overlay.querySelector('.live-photo-room').textContent = `Sala ${room}`;
    overlay.querySelector('.live-photo-pair-url').textContent = pairUrl.toString();

    await renderQr(pairUrl.toString());
  }

  async function renderQr(text) {
    const img = overlay.querySelector('.live-photo-qr');
    const placeholder = overlay.querySelector('.live-photo-qr-placeholder');

    revokeQrObjectUrl();
    img.classList.add('live-photo-hidden');
    placeholder.classList.remove('live-photo-hidden');
    placeholder.textContent = 'Preparando QR…';

    if (!config.qrEndpoint) {
      placeholder.textContent = 'QR no configurado. Usa el enlace mostrado debajo.';
      return;
    }

    try {
      const response = await fetch(config.qrEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) throw new Error(`QR HTTP ${response.status}`);
      const blob = await response.blob();
      qrObjectUrl = URL.createObjectURL(blob);
      img.src = qrObjectUrl;
      img.classList.remove('live-photo-hidden');
      placeholder.classList.add('live-photo-hidden');
    } catch (error) {
      console.error('[reveal-live-photo] QR', error);
      placeholder.textContent = 'No se pudo generar el QR. Usa el enlace mostrado debajo.';
    }
  }

  function revokeQrObjectUrl() {
    if (qrObjectUrl) {
      URL.revokeObjectURL(qrObjectUrl);
      qrObjectUrl = null;
    }
  }

  async function createPeerConnection() {
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

    pc.addEventListener('connectionstatechange', () => {
      if (!pc) return;
      switch (pc.connectionState) {
        case 'connected':
          setStatus('● Móvil conectado');
          pairingElement.classList.add('live-photo-hidden');
          break;
        case 'failed':
          setStatus('Falló WebRTC');
          break;
        case 'disconnected':
          setStatus('Móvil desconectado');
          break;
      }
    });

    channel = pc.createDataChannel('live-photo', { ordered: true });
    configureDataChannel(channel);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    sendWs({
      type: 'signal',
      roomId,
      data: { type: 'offer', sdp: pc.localDescription },
    });
  }

  async function handleSignal(data) {
    if (!data) return;

    if (data.type === 'answer') {
      if (!pc) return;
      await pc.setRemoteDescription(data.sdp);
      for (const candidate of pendingIceCandidates) {
        await pc.addIceCandidate(candidate);
      }
      pendingIceCandidates = [];
      return;
    }

    if (data.type === 'candidate') {
      if (!pc) return;
      if (pc.remoteDescription) {
        await pc.addIceCandidate(data.candidate);
      } else {
        pendingIceCandidates.push(data.candidate);
      }
    }
  }

  function configureDataChannel(dc) {
    dc.binaryType = 'arraybuffer';

    dc.addEventListener('open', () => {
      setStatus('● Móvil conectado');
      pairingElement.classList.add('live-photo-hidden');
    });

    dc.addEventListener('close', () => {
      setStatus('Móvil desconectado');
    });

    dc.addEventListener('message', (event) => {
      if (typeof event.data === 'string') {
        try {
          handleControlMessage(JSON.parse(event.data));
        } catch (error) {
          console.error('[reveal-live-photo] control message', error);
        }
      } else {
        handleBinaryChunk(event.data);
      }
    });
  }

  function handleControlMessage(message) {
    switch (message.type) {
      case 'photo:start':
        currentTransfer = {
          meta: message,
          chunks: [],
          received: 0,
        };
        setStatus('Recibiendo fotografía…');
        break;

      case 'photo:end':
        finishPhoto();
        break;
    }
  }

  function handleBinaryChunk(chunk) {
    if (!currentTransfer) return;
    const buffer = chunk instanceof ArrayBuffer ? chunk : chunk.buffer;
    currentTransfer.chunks.push(buffer);
    currentTransfer.received += buffer.byteLength;
  }

  function finishPhoto() {
    if (!currentTransfer) return;

    const expected = Number(currentTransfer.meta.size || 0);
    if (expected && expected !== currentTransfer.received) {
      console.warn('[reveal-live-photo] Size mismatch', {
        expected,
        received: currentTransfer.received,
      });
    }

    const blob = new Blob(currentTransfer.chunks, {
      type: currentTransfer.meta.mimeType || 'image/jpeg',
    });

    photos.push({
      id: currentTransfer.meta.id || crypto.randomUUID?.() || String(Date.now()),
      url: URL.createObjectURL(blob),
      width: currentTransfer.meta.width,
      height: currentTransfer.meta.height,
      timestamp: Date.now(),
    });

    while (photos.length > config.maxPhotos) {
      const removed = photos.shift();
      URL.revokeObjectURL(removed.url);
    }

    photoIndex = photos.length - 1;
    currentTransfer = null;
    renderPhoto();
    setStatus('● Móvil conectado');
    if (config.autoShow) show();
  }

  function renderPhoto() {
    if (photoIndex < 0 || !photos[photoIndex]) return;
    pairingElement.classList.add('live-photo-hidden');
    viewerElement.classList.remove('live-photo-hidden');
    imageElement.src = photos[photoIndex].url;
    counterElement.textContent = `${photoIndex + 1} / ${photos.length}`;
    resetTransform();
  }

  function previousPhoto() {
    if (!photos.length) return;
    photoIndex = Math.max(0, photoIndex - 1);
    renderPhoto();
  }

  function nextPhoto() {
    if (!photos.length) return;
    photoIndex = Math.min(photos.length - 1, photoIndex + 1);
    renderPhoto();
  }

  function deleteCurrentPhoto() {
    if (photoIndex < 0 || !photos[photoIndex]) return;
    const [removed] = photos.splice(photoIndex, 1);
    URL.revokeObjectURL(removed.url);

    if (!photos.length) {
      photoIndex = -1;
      imageElement.removeAttribute('src');
      viewerElement.classList.add('live-photo-hidden');
      pairingElement.classList.remove('live-photo-hidden');
      return;
    }

    photoIndex = Math.min(photoIndex, photos.length - 1);
    renderPhoto();
  }

  function clearPhotos() {
    photos.forEach((photo) => URL.revokeObjectURL(photo.url));
    photos = [];
    photoIndex = -1;
    currentTransfer = null;
    if (imageElement) imageElement.removeAttribute('src');
  }

  function setZoom(value) {
    zoom = Math.max(0.25, Math.min(5, value));
    if (zoom <= 1) {
      translateX = 0;
      translateY = 0;
    }
    updateTransform();
  }

  function resetTransform() {
    zoom = 1;
    rotation = 0;
    translateX = 0;
    translateY = 0;
    updateTransform();
  }

  function updateTransform() {
    if (!imageElement) return;
    imageElement.style.transform = `translate(${translateX}px, ${translateY}px) scale(${zoom}) rotate(${rotation}deg)`;
  }

  function handleKeyboard(event) {
    if (!overlay || overlay.classList.contains('live-photo-hidden')) return;

    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        hide();
        break;
      case 'ArrowLeft':
        event.preventDefault();
        event.stopPropagation();
        previousPhoto();
        break;
      case 'ArrowRight':
        event.preventDefault();
        event.stopPropagation();
        nextPhoto();
        break;
      case '+':
      case '=':
        event.preventDefault();
        event.stopPropagation();
        setZoom(zoom + 0.25);
        break;
      case '-':
        event.preventDefault();
        event.stopPropagation();
        setZoom(zoom - 0.25);
        break;
      case 'r':
      case 'R':
        event.preventDefault();
        event.stopPropagation();
        rotation = (rotation + 90) % 360;
        updateTransform();
        break;
    }
  }

  function closePeerConnection() {
    try { channel?.close(); } catch {}
    try { pc?.close(); } catch {}
    channel = null;
    pc = null;
    pendingIceCandidates = [];
    currentTransfer = null;
  }

  function setStatus(text) {
    if (statusElement) statusElement.textContent = text;
  }

  return plugin;
}
