(() => {
  'use strict';
  const TOTAL = 34;
  const slide = document.querySelector('#slide');
  const slideVideo = document.querySelector('#slideVideo');
  const stage = document.querySelector('#stage');
  const status = document.querySelector('#status');
  const progress = document.querySelector('#progress span');
  const prevButton = document.querySelector('#prev');
  const nextButton = document.querySelector('#next');
  const notesButton = document.querySelector('#notes');
  const help = document.querySelector('#help');
  const overviewPanel = document.querySelector('#overviewPanel');
  const thumbs = document.querySelector('#thumbs');
  const notesPanel = document.querySelector('#notesPanel');
  const noteSlideNumber = document.querySelector('#noteSlideNumber');
  const slideNote = document.querySelector('#slideNote');
  const noteSaved = document.querySelector('#noteSaved');
  const noteCount = document.querySelector('#noteCount');
  const copyNotes = document.querySelector('#copyNotes');
  const downloadNotes = document.querySelector('#downloadNotes');
  const clearNote = document.querySelector('#clearNote');
  const NOTES_KEY = 'dka-education-slide-notes-v5';
  const OLD_NOTES_KEYS = [
    {key: 'dka-education-slide-notes-v4', insertsAfter: [15]},
    {key: 'dka-education-slide-notes-v3', insertsAfter: [13, 14]},
    {key: 'dka-education-slide-notes-v2', insertsAfter: [13, 14, 15]},
    {key: 'dka-education-slide-notes-v1', insertsAfter: [10, 12, 13, 14, 20, 24]}
  ];
  const VIDEO_SLIDES = {
    14: {src: 'media/sglt2i-mechanism.mp4', label: 'SGLT2i 機轉影片'}
  };
  let current = Math.min(TOTAL, Math.max(1, Number(location.hash.slice(1)) || 1));
  let controlsVisible = true;
  let touchStartX = null;
  let wakeTimer;
  let notes = loadNotes();
  const ASSET_VERSION = '20260802-glp1ra-mechanism';

  const pathFor = n => `slides/slide-${String(n).padStart(2, '0')}.png?v=${ASSET_VERSION}`;
  const mediaPathFor = path => `${path}?v=${ASSET_VERSION}`;

  function migrateNotes(source, insertsAfter) {
    const migrated = {};
    Object.entries(source).forEach(([key, value]) => {
      const oldSlide = Number(key);
      if (!Number.isFinite(oldSlide)) return;
      const shift = insertsAfter.filter(marker => marker < oldSlide).length;
      migrated[oldSlide + shift] = value;
    });
    return migrated;
  }

  function show(n, updateHistory = true) {
    const next = Math.min(TOTAL, Math.max(1, n));
    const videoSlide = VIDEO_SLIDES[next];
    if (next !== current) document.querySelector('#deck').animate([{opacity:.58},{opacity:1}], {duration:180,easing:'ease-out'});
    current = next;
    if (videoSlide) {
      slide.hidden = true;
      slideVideo.hidden = false;
      if (slideVideo.dataset.slide !== String(current)) {
        slideVideo.pause();
        slideVideo.src = mediaPathFor(videoSlide.src);
        slideVideo.poster = pathFor(current);
        slideVideo.dataset.slide = String(current);
      }
      slideVideo.setAttribute('aria-label', `第 ${current} 張投影片：${videoSlide.label}`);
    } else {
      if (!slideVideo.hidden) {
        slideVideo.pause();
        slideVideo.hidden = true;
      }
      slide.hidden = false;
      slide.src = pathFor(current);
      slide.alt = `第 ${current} 張投影片，共 ${TOTAL} 張`;
    }
    status.textContent = `${current} / ${TOTAL}`;
    progress.style.width = `${current / TOTAL * 100}%`;
    prevButton.disabled = current === 1;
    nextButton.disabled = current === TOTAL;
    document.querySelectorAll('.thumb').forEach((item, index) => item.classList.toggle('current', index + 1 === current));
    if (updateHistory) history.replaceState(null, '', `#${current}`);
    [current + 1, current - 1].filter(n => n > 0 && n <= TOTAL).forEach(n => { const img = new Image(); img.src = pathFor(n); });
    updateNotePanel();
  }

  function toggleChrome(force) {
    controlsVisible = typeof force === 'boolean' ? force : !controlsVisible;
    stage.classList.toggle('hidden-chrome', !controlsVisible);
  }

  function closePanels() { help.hidden = true; overviewPanel.hidden = true; }
  function toggleHelp() { const open = help.hidden; closePanels(); help.hidden = !open; }
  function toggleOverview() { const open = overviewPanel.hidden; closePanels(); overviewPanel.hidden = !open; if (open) document.querySelector('.thumb.current')?.scrollIntoView({block:'center'}); }
  function toggleNotes(force) {
    const open = typeof force === 'boolean' ? force : notesPanel.hidden;
    notesPanel.hidden = !open;
    stage.classList.toggle('notes-open', open);
    notesButton.setAttribute('aria-pressed', String(open));
    if (open) setTimeout(() => slideNote.focus(), 0);
  }
  async function toggleFullscreen() {
    try { if (!document.fullscreenElement) await document.documentElement.requestFullscreen(); else await document.exitFullscreen(); } catch (_) {}
  }

  function loadNotes() {
    try {
      const saved = localStorage.getItem(NOTES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed && typeof parsed === 'object' ? parsed : {};
      }
      for (const oldKey of OLD_NOTES_KEYS) {
        const oldSaved = localStorage.getItem(oldKey.key);
        if (!oldSaved) continue;
        const oldNotes = JSON.parse(oldSaved);
        if (!oldNotes || typeof oldNotes !== 'object') continue;
        const migrated = migrateNotes(oldNotes, oldKey.insertsAfter);
        localStorage.setItem(NOTES_KEY, JSON.stringify(migrated));
        return migrated;
      }
      return {};
    } catch (_) {
      return {};
    }
  }

  function saveNotes() {
    try {
      localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
      noteSaved.textContent = '已儲存';
    } catch (_) {
      noteSaved.textContent = '無法儲存';
    }
  }

  function updateNoteMeta() {
    const text = slideNote.value;
    noteCount.textContent = `${text.trim().length} 字`;
    notesButton.classList.toggle('has-note', Boolean(notes[current]?.trim()));
    document.querySelectorAll('.thumb').forEach((item, index) => item.classList.toggle('has-note', Boolean(notes[index + 1]?.trim())));
  }

  function updateNotePanel() {
    if (!slideNote) return;
    noteSlideNumber.textContent = current;
    slideNote.value = notes[current] || '';
    updateNoteMeta();
  }

  function writeCurrentNote() {
    const text = slideNote.value;
    if (text.trim()) notes[current] = text;
    else delete notes[current];
    saveNotes();
    updateNoteMeta();
  }

  function allNotesText() {
    const lines = [
      '守護「腎」利人生｜我的投影片筆記',
      `匯出時間：${new Date().toLocaleString('zh-TW')}`,
      ''
    ];
    for (let i = 1; i <= TOTAL; i++) {
      const text = notes[i]?.trim();
      if (!text) continue;
      lines.push(`第 ${i} 張`, text, '');
    }
    if (lines.length === 3) lines.push('尚未建立筆記。');
    return lines.join('\n');
  }

  async function copyAllNotes() {
    const text = allNotesText();
    try {
      await navigator.clipboard.writeText(text);
      noteSaved.textContent = '已複製';
    } catch (_) {
      const fallback = document.createElement('textarea');
      fallback.value = text;
      fallback.setAttribute('readonly', '');
      fallback.style.position = 'fixed';
      fallback.style.opacity = '0';
      document.body.append(fallback);
      fallback.select();
      const copied = document.execCommand('copy');
      fallback.remove();
      noteSaved.textContent = copied ? '已複製' : '請手動複製';
    }
  }

  function downloadAllNotes() {
    const blob = new Blob([allNotesText()], {type:'text/plain;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '守護腎利人生_我的筆記.txt';
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    noteSaved.textContent = '已下載';
  }

  function clearCurrentNote() {
    if (slideNote.value.trim() && !confirm('清除這張投影片的筆記？')) return;
    slideNote.value = '';
    writeCurrentNote();
  }

  function onKey(event) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key;
    if (key === 'Escape') { closePanels(); toggleNotes(false); return; }
    if (!notesPanel.hidden && notesPanel.contains(document.activeElement)) return;
    if (!help.hidden || !overviewPanel.hidden) return;
    if (['ArrowRight','ArrowDown','PageDown',' ','Enter','MediaTrackNext'].includes(key)) { event.preventDefault(); show(current + 1); }
    else if (['ArrowLeft','ArrowUp','PageUp','Backspace','MediaTrackPrevious'].includes(key)) { event.preventDefault(); show(current - 1); }
    else if (key === 'Home') { event.preventDefault(); show(1); }
    else if (key === 'End') { event.preventDefault(); show(TOTAL); }
    else if (key.toLowerCase() === 'f') toggleFullscreen();
    else if (key.toLowerCase() === 'o') toggleOverview();
    else if (key.toLowerCase() === 'n') toggleNotes();
    else if (key.toLowerCase() === 'h') toggleChrome();
    else if (key === '?' || key === '/') toggleHelp();
  }

  for (let i = 1; i <= TOTAL; i++) {
    const button = document.createElement('button');
    button.className = 'thumb'; button.type = 'button'; button.setAttribute('aria-label', `前往第 ${i} 張`);
    button.innerHTML = `<img src="${pathFor(i)}" alt="" loading="lazy"><span>${i}</span>`;
    button.addEventListener('click', () => { show(i); closePanels(); });
    thumbs.append(button);
  }

  prevButton.addEventListener('click', () => show(current - 1));
  nextButton.addEventListener('click', () => show(current + 1));
  document.querySelector('#fullscreen').addEventListener('click', toggleFullscreen);
  document.querySelector('#overview').addEventListener('click', toggleOverview);
  notesButton.addEventListener('click', () => toggleNotes());
  slideNote.addEventListener('input', writeCurrentNote);
  copyNotes.addEventListener('click', copyAllNotes);
  downloadNotes.addEventListener('click', downloadAllNotes);
  clearNote.addEventListener('click', clearCurrentNote);
  document.querySelector('[data-notes-close]').addEventListener('click', () => toggleNotes(false));
  document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', closePanels));
  document.addEventListener('keydown', onKey);
  window.addEventListener('hashchange', () => show(Number(location.hash.slice(1)) || 1, false));
  stage.addEventListener('touchstart', event => {
    if (!notesPanel.hidden && notesPanel.contains(event.target)) {
      touchStartX = null;
      return;
    }
    touchStartX = event.changedTouches[0].clientX;
  }, {passive:true});
  stage.addEventListener('touchend', event => {
    if (!notesPanel.hidden && notesPanel.contains(event.target)) return;
    if (touchStartX === null) return;
    const dx = event.changedTouches[0].clientX - touchStartX;
    touchStartX = null;
    if (Math.abs(dx) > 55) show(current + (dx < 0 ? 1 : -1));
  }, {passive:true});
  stage.addEventListener('mousemove', () => { toggleChrome(true); clearTimeout(wakeTimer); wakeTimer = setTimeout(() => toggleChrome(false), 2600); });
  stage.addEventListener('dblclick', event => { if (notesPanel.hidden || !notesPanel.contains(event.target)) toggleFullscreen(); });
  show(current, false);
  notesButton.setAttribute('aria-pressed', 'false');
  help.hidden = false;
  document.querySelector('#deck').focus();
})();
