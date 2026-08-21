(() => {
  'use strict';

  const TOTAL = 34;
  const ASSET_VERSION = '20260821-speaker-script';
  const SCRIPT_FILE = '守護腎利人生_台語俗諺活潑版逐字稿.md';

  const slideThumb = document.querySelector('#slideThumb');
  const slideCount = document.querySelector('#slideCount');
  const slideTitle = document.querySelector('#slideTitle');
  const scriptText = document.querySelector('#scriptText');
  const slideSelect = document.querySelector('#slideSelect');
  const projectorLink = document.querySelector('#projectorLink');
  const firstSlide = document.querySelector('#firstSlide');
  const prevSlide = document.querySelector('#prevSlide');
  const nextSlide = document.querySelector('#nextSlide');
  const lastSlide = document.querySelector('#lastSlide');
  const smallerText = document.querySelector('#smallerText');
  const largerText = document.querySelector('#largerText');
  const wakeLockButton = document.querySelector('#wakeLock');

  let current = initialSlide();
  let scripts = new Map();
  let wakeLock = null;
  let scriptSize = Number(localStorage.getItem('dka-speaker-script-size')) || 20;

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
    projectorLink.href = `index.html#${current}`;
    firstSlide.disabled = current === 1;
    prevSlide.disabled = current === 1;
    nextSlide.disabled = current === TOTAL;
    lastSlide.disabled = current === TOTAL;
    localStorage.setItem('dka-speaker-current-slide', String(current));
    history.replaceState(null, '', `#${current}`);
    [current + 1, current - 1].filter(n => n >= 1 && n <= TOTAL).forEach(n => {
      const img = new Image();
      img.src = slidePath(n);
    });
  }

  function go(n) {
    current = Math.min(TOTAL, Math.max(1, n));
    render();
    window.scrollTo({top: 0, behavior: 'smooth'});
  }

  function changeTextSize(delta) {
    scriptSize = Math.min(30, Math.max(16, scriptSize + delta));
    document.documentElement.style.setProperty('--script-size', `${scriptSize}px`);
    localStorage.setItem('dka-speaker-script-size', String(scriptSize));
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
  window.addEventListener('hashchange', () => go(Number(location.hash.slice(1)) || current));
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && wakeLockButton.classList.contains('active') && !wakeLock) {
      await toggleWakeLock();
    }
  });

  function loadFromEmbedded() {
    if (!Array.isArray(window.SPEAKER_SCRIPT)) return false;
    scripts = scriptsFromData(window.SPEAKER_SCRIPT);
    render();
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
      })
      .catch(() => {
        if (!loadFromEmbedded()) {
          slideTitle.textContent = '逐字稿載入失敗';
          scriptText.innerHTML = '<p>請確認逐字稿檔案已放在網站資料夾，或稍後重新整理。</p>';
        }
      });
  }
})();
