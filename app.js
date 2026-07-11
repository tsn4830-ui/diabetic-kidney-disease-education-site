(() => {
  'use strict';
  const TOTAL = 28;
  const slide = document.querySelector('#slide');
  const stage = document.querySelector('#stage');
  const status = document.querySelector('#status');
  const progress = document.querySelector('#progress span');
  const prevButton = document.querySelector('#prev');
  const nextButton = document.querySelector('#next');
  const help = document.querySelector('#help');
  const overviewPanel = document.querySelector('#overviewPanel');
  const thumbs = document.querySelector('#thumbs');
  let current = Math.min(TOTAL, Math.max(1, Number(location.hash.slice(1)) || 1));
  let controlsVisible = true;
  let touchStartX = 0;
  let wakeTimer;

  const pathFor = n => `slides/slide-${String(n).padStart(2, '0')}.png`;

  function show(n, updateHistory = true) {
    const next = Math.min(TOTAL, Math.max(1, n));
    if (next !== current) slide.animate([{opacity:.58},{opacity:1}], {duration:180,easing:'ease-out'});
    current = next;
    slide.src = pathFor(current);
    slide.alt = `第 ${current} 張投影片，共 ${TOTAL} 張`;
    status.textContent = `${current} / ${TOTAL}`;
    progress.style.width = `${current / TOTAL * 100}%`;
    prevButton.disabled = current === 1;
    nextButton.disabled = current === TOTAL;
    document.querySelectorAll('.thumb').forEach((item, index) => item.classList.toggle('current', index + 1 === current));
    if (updateHistory) history.replaceState(null, '', `#${current}`);
    [current + 1, current - 1].filter(n => n > 0 && n <= TOTAL).forEach(n => { const img = new Image(); img.src = pathFor(n); });
  }

  function toggleChrome(force) {
    controlsVisible = typeof force === 'boolean' ? force : !controlsVisible;
    stage.classList.toggle('hidden-chrome', !controlsVisible);
  }

  function closePanels() { help.hidden = true; overviewPanel.hidden = true; }
  function toggleHelp() { const open = help.hidden; closePanels(); help.hidden = !open; }
  function toggleOverview() { const open = overviewPanel.hidden; closePanels(); overviewPanel.hidden = !open; if (open) document.querySelector('.thumb.current')?.scrollIntoView({block:'center'}); }
  async function toggleFullscreen() {
    try { if (!document.fullscreenElement) await document.documentElement.requestFullscreen(); else await document.exitFullscreen(); } catch (_) {}
  }

  function onKey(event) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key;
    if (key === 'Escape') { closePanels(); return; }
    if (!help.hidden || !overviewPanel.hidden) return;
    if (['ArrowRight','ArrowDown','PageDown',' ','Enter','MediaTrackNext'].includes(key)) { event.preventDefault(); show(current + 1); }
    else if (['ArrowLeft','ArrowUp','PageUp','Backspace','MediaTrackPrevious'].includes(key)) { event.preventDefault(); show(current - 1); }
    else if (key === 'Home') { event.preventDefault(); show(1); }
    else if (key === 'End') { event.preventDefault(); show(TOTAL); }
    else if (key.toLowerCase() === 'f') toggleFullscreen();
    else if (key.toLowerCase() === 'o') toggleOverview();
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
  document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', closePanels));
  document.addEventListener('keydown', onKey);
  window.addEventListener('hashchange', () => show(Number(location.hash.slice(1)) || 1, false));
  stage.addEventListener('touchstart', event => { touchStartX = event.changedTouches[0].clientX; }, {passive:true});
  stage.addEventListener('touchend', event => { const dx = event.changedTouches[0].clientX - touchStartX; if (Math.abs(dx) > 55) show(current + (dx < 0 ? 1 : -1)); }, {passive:true});
  stage.addEventListener('mousemove', () => { toggleChrome(true); clearTimeout(wakeTimer); wakeTimer = setTimeout(() => toggleChrome(false), 2600); });
  stage.addEventListener('dblclick', toggleFullscreen);
  show(current, false);
  help.hidden = false;
  document.querySelector('#deck').focus();
})();
