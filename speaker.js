(() => {
  'use strict';

  const TOTAL = 34;
  const ASSET_VERSION = '20260821-speaker-sync';
  const SCRIPT_FILE = '守護腎利人生_台語俗諺活潑版逐字稿.md';
  const PUBLIC_BASE_URL = 'https://tsn4830-ui.github.io/diabetic-kidney-disease-education-site/';
  const SYNC_BASE_URL = 'https://ntfy.sh/';
  const ROOM_PARAM = 'room';
  const ROOM_STORAGE_KEY = 'dka-speaker-sync-room';

  const slideThumb = document.querySelector('#slideThumb');
  const slideCount = document.querySelector('#slideCount');
  const slideTitle = document.querySelector('#slideTitle');
  const scriptText = document.querySelector('#scriptText');
  const slideSelect = document.querySelector('#slideSelect');
  const projectorLink = document.querySelector('#projectorLink');
  const roomCode = document.querySelector('#roomCode');
  const syncStatus = document.querySelector('#syncStatus');
  const copyProjectorLink = document.querySelector('#copyProjectorLink');
  const firstSlide = document.querySelector('#firstSlide');
  const prevSlide = document.querySelector('#prevSlide');
  const nextSlide = document.querySelector('#nextSlide');
  const lastSlide = document.querySelector('#lastSlide');
  const smallerText = document.querySelector('#smallerText');
  const largerText = document.querySelector('#largerText');
  const wakeLockButton = document.querySelector('#wakeLock');
  const scrollScriptUp = document.querySelector('#scrollScriptUp');
  const scrollScriptDown = document.querySelector('#scrollScriptDown');
  const autoScrollButton = document.querySelector('#autoScroll');

  let current = initialSlide();
  let scripts = new Map();
  let wakeLock = null;
  let scriptSize = Number(localStorage.getItem('dka-speaker-script-size')) || 20;
  let autoScrollTimer = null;
  let syncRoom = initialRoom();
  let syncSource = null;
  let suppressSyncPublish = false;
  const clientId = clientIdentity();

  document.documentElement.style.setProperty('--script-size', `${scriptSize}px`);

  for (let i = 1; i <= TOTAL; i++) {
    const option = document.createElement('option');
    option.value = String(i);
    option.textContent = `第 ${i} 張`;
    slideSelect.append(option);
  }

  function initialSlide() {
    const fromHash = Number(location.hash.slice(1));
    const saved = Number(localStorage.getItem('dka-speaker-current-slide'));
    const raw = Number.isFinite(fromHash) && fromHash > 0 ? fromHash : saved;
    return Math.min(TOTAL, Math.max(1, raw || 1));
  }

  function clientIdentity() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function sanitizeRoom(value) {
    return String(value || '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 8);
  }

  function randomRoom() {
    return Math.random().toString(36).slice(2, 8).toUpperCase();
  }

  function initialRoom() {
    const params = new URLSearchParams(location.search);
    const fromUrl = sanitizeRoom(params.get(ROOM_PARAM));
    const fromStorage = sanitizeRoom(localStorage.getItem(ROOM_STORAGE_KEY));
    const room = fromUrl || fromStorage || randomRoom();
    localStorage.setItem(ROOM_STORAGE_KEY, room);
    return room;
  }

  function roomTopic() {
    return `dka-${syncRoom.toLowerCase()}`;
  }

  function pageUrl(page, slideNumber = current) {
    const base = location.protocol === 'file:' ? PUBLIC_BASE_URL : location.href;
    const url = new URL(page, base);
    url.searchParams.set(ROOM_PARAM, syncRoom);
    url.hash = String(slideNumber);
    return url.href;
  }

  function updateAddress() {
    const params = new URLSearchParams(location.search);
    params.set(ROOM_PARAM, syncRoom);
    const query = params.toString();
    history.replaceState(null, '', `${location.pathname}${query ? `?${query}` : ''}#${current}`);
  }

  function setSyncStatus(text) {
    if (syncStatus) syncStatus.textContent = text;
  }

  function updateSyncUi() {
    if (roomCode) roomCode.textContent = syncRoom;
    if (projectorLink) projectorLink.href = pageUrl('index.html');
  }

  function syncPayloadFromEvent(data) {
    try {
      const parsed = JSON.parse(data);
      if (typeof parsed?.message === 'string') return JSON.parse(parsed.message);
      return parsed;
    } catch (_) {
      return null;
    }
  }

  function slidePath(n) {
    return `slides/slide-${String(n).padStart(2, '0')}.png?v=${ASSET_VERSION}`;
  }

  function escapeHtml(value) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeMarkdownText(text) {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/  \n/g, '\n')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .trim();
  }

  function parseScripts(markdown) {
    const lines = markdown.split(/\r?\n/);
    const parsed = new Map();
    let active = null;
    let buffer = [];

    function commit() {
      if (!active) return;
      parsed.set(active.number, {
        title: active.title,
        body: normalizeMarkdownText(buffer.join('\n'))
      });
    }

    for (const line of lines) {
      const slideMatch = line.match(/^## 第\s*(\d+)\s*張｜(.+)$/);
      if (slideMatch) {
        commit();
        active = {number: Number(slideMatch[1]), title: slideMatch[2].trim()};
        buffer = [];
        continue;
      }
      if (/^## 講者備查/.test(line)) {
        commit();
        active = null;
        buffer = [];
        break;
      }
      if (active) buffer.push(line);
    }
    commit();
    return parsed;
  }

  function scriptsFromData(data) {
    const parsed = new Map();
    data.forEach(item => {
      if (!item || !Number.isFinite(Number(item.number))) return;
      parsed.set(Number(item.number), {
        title: String(item.title || ''),
        body: normalizeMarkdownText(String(item.body || ''))
      });
    });
    return parsed;
  }

  function paragraphsFrom(body) {
    if (!body) return '<p>這張尚未建立逐字稿。</p>';
    return body
      .split(/\n{2,}/)
      .map(part => part.trim())
      .filter(Boolean)
      .map(part => `<p>${escapeHtml(part).replace(/\n/g, '<br>')}</p>`)
      .join('');
  }

  function render() {
    const item = scripts.get(current);
    slideThumb.src = slidePath(current);
    slideThumb.alt = `第 ${current} 張投影片縮圖`;
    slideCount.textContent = `第 ${current} / ${TOTAL} 張`;
    slideTitle.textContent = item?.title || `第 ${current} 張`;
    scriptText.innerHTML = paragraphsFrom(item?.body);
    slideSelect.value = String(current);
    updateSyncUi();
    firstSlide.disabled = current === 1;
    prevSlide.disabled = current === 1;
    nextSlide.disabled = current === TOTAL;
    lastSlide.disabled = current === TOTAL;
    localStorage.setItem('dka-speaker-current-slide', String(current));
    updateAddress();
    [current + 1, current - 1].filter(n => n >= 1 && n <= TOTAL).forEach(n => {
      const img = new Image();
      img.src = slidePath(n);
    });
  }

  function go(n, options = {}) {
    current = Math.min(TOTAL, Math.max(1, n));
    render();
    scriptText.scrollTo({top: 0, behavior: options.fromRemote ? 'auto' : 'smooth'});
    window.scrollTo({top: 0, behavior: 'smooth'});
    if (!options.fromRemote && !suppressSyncPublish) publishSync();
  }

  function changeTextSize(delta) {
    scriptSize = Math.min(30, Math.max(16, scriptSize + delta));
    document.documentElement.style.setProperty('--script-size', `${scriptSize}px`);
    localStorage.setItem('dka-speaker-script-size', String(scriptSize));
  }

  async function publishSync() {
    if (!syncRoom) return;
    if (location.protocol === 'file:') {
      setSyncStatus('請用公開網址同步');
      return;
    }
    const payload = JSON.stringify({
      type: 'slide',
      slide: current,
      sender: clientId,
      ts: Date.now()
    });
    setSyncStatus(`同步第 ${current} 張中`);
    try {
      await fetch(`${SYNC_BASE_URL}${encodeURIComponent(roomTopic())}`, {
        method: 'POST',
        body: payload,
        mode: 'cors',
        keepalive: true
      });
      setSyncStatus(`已同步第 ${current} 張`);
    } catch (_) {
      setSyncStatus('同步失敗，請換網路');
    }
  }

  function connectSync() {
    updateSyncUi();
    if (!syncRoom) return;
    if (location.protocol === 'file:') {
      setSyncStatus('公開網址才會同步');
      return;
    }
    if (!window.EventSource) {
      setSyncStatus('此瀏覽器不支援同步');
      return;
    }
    syncSource?.close();
    syncSource = new EventSource(`${SYNC_BASE_URL}${encodeURIComponent(roomTopic())}/sse`);
    syncSource.addEventListener('open', () => setSyncStatus('同步已連線'));
    syncSource.addEventListener('error', () => setSyncStatus('同步重連中'));
    syncSource.addEventListener('message', event => {
      const payload = syncPayloadFromEvent(event.data);
      if (!payload || payload.type !== 'slide' || payload.sender === clientId) return;
      const slideNumber = Number(payload.slide);
      if (!Number.isFinite(slideNumber) || slideNumber < 1 || slideNumber > TOTAL) return;
      if (slideNumber === current) {
        setSyncStatus(`已在第 ${current} 張`);
        return;
      }
      suppressSyncPublish = true;
      go(slideNumber, {fromRemote: true});
      suppressSyncPublish = false;
      setSyncStatus(`跟到第 ${current} 張`);
    });
  }

  async function copyProjectorUrl() {
    const url = pageUrl('index.html');
    updateSyncUi();
    try {
      await navigator.clipboard.writeText(url);
      copyProjectorLink.textContent = '已複製';
    } catch (_) {
      const fallback = document.createElement('textarea');
      fallback.value = url;
      fallback.setAttribute('readonly', '');
      fallback.style.position = 'fixed';
      fallback.style.opacity = '0';
      document.body.append(fallback);
      fallback.select();
      const copied = document.execCommand('copy');
      fallback.remove();
      copyProjectorLink.textContent = copied ? '已複製' : '長按複製';
    }
    setTimeout(() => {
      copyProjectorLink.textContent = '複製投影連結';
    }, 1800);
  }

  function scrollScript(direction) {
    const distance = Math.max(170, scriptText.clientHeight * 0.72);
    scriptText.scrollBy({top: direction * distance, behavior: 'smooth'});
  }

  function stopAutoScroll() {
    if (!autoScrollTimer) return;
    clearInterval(autoScrollTimer);
    autoScrollTimer = null;
    autoScrollButton.classList.remove('active');
    autoScrollButton.textContent = '自動捲';
  }

  function toggleAutoScroll() {
    if (autoScrollTimer) {
      stopAutoScroll();
      return;
    }
    autoScrollButton.classList.add('active');
    autoScrollButton.textContent = '停止捲';
    autoScrollTimer = setInterval(() => {
      const atBottom = scriptText.scrollTop + scriptText.clientHeight >= scriptText.scrollHeight - 6;
      if (atBottom) {
        stopAutoScroll();
        return;
      }
      scriptText.scrollBy({top: 1, behavior: 'auto'});
    }, 95);
  }

  async function toggleWakeLock() {
    if (!('wakeLock' in navigator)) {
      wakeLockButton.textContent = '此手機不支援';
      return;
    }
    try {
      if (wakeLock) {
        await wakeLock.release();
        wakeLock = null;
        wakeLockButton.classList.remove('active');
        wakeLockButton.textContent = '保持亮螢幕';
        return;
      }
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLockButton.classList.add('active');
      wakeLockButton.textContent = '亮螢幕中';
      wakeLock.addEventListener('release', () => {
        wakeLock = null;
        wakeLockButton.classList.remove('active');
        wakeLockButton.textContent = '保持亮螢幕';
      });
    } catch (_) {
      wakeLockButton.textContent = '無法保持亮螢幕';
    }
  }

  firstSlide.addEventListener('click', () => go(1));
  prevSlide.addEventListener('click', () => go(current - 1));
  nextSlide.addEventListener('click', () => go(current + 1));
  lastSlide.addEventListener('click', () => go(TOTAL));
  slideSelect.addEventListener('change', () => go(Number(slideSelect.value)));
  smallerText.addEventListener('click', () => changeTextSize(-1));
  largerText.addEventListener('click', () => changeTextSize(1));
  wakeLockButton.addEventListener('click', toggleWakeLock);
  copyProjectorLink.addEventListener('click', copyProjectorUrl);
  scrollScriptUp.addEventListener('click', () => scrollScript(-1));
  scrollScriptDown.addEventListener('click', () => scrollScript(1));
  autoScrollButton.addEventListener('click', toggleAutoScroll);
  window.addEventListener('hashchange', () => go(Number(location.hash.slice(1)) || current));
  window.addEventListener('beforeunload', () => syncSource?.close());
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && wakeLockButton.classList.contains('active') && !wakeLock) {
      await toggleWakeLock();
    }
  });

  function loadFromEmbedded() {
    if (!Array.isArray(window.SPEAKER_SCRIPT)) return false;
    scripts = scriptsFromData(window.SPEAKER_SCRIPT);
    render();
    connectSync();
    return true;
  }

  if (location.protocol === 'file:') {
    if (!loadFromEmbedded()) {
      slideTitle.textContent = '逐字稿載入失敗';
      scriptText.innerHTML = '<p>請使用公開網址或本機伺服器開啟手機講者稿。</p>';
    }
  } else {
    fetch(encodeURI(`${SCRIPT_FILE}?v=${ASSET_VERSION}`))
      .then(response => {
        if (!response.ok) throw new Error('Failed to load script');
        return response.text();
      })
      .then(markdown => {
        scripts = parseScripts(markdown);
        render();
        connectSync();
      })
      .catch(() => {
        if (!loadFromEmbedded()) {
          slideTitle.textContent = '逐字稿載入失敗';
          scriptText.innerHTML = '<p>請確認逐字稿檔案已放在網站資料夾，或稍後重新整理。</p>';
        }
      });
  }
})();
