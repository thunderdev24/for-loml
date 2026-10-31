/* ===================================================================
   🌸 Cute Floating AI Guide & Companion Widget (For Ifra)
   - Grand welcome right after she taps the rose
   - A guided journey through every section, with a small "survey" question at each stop
   - Chat that knows the whole website (see agent-brain.js)
   Everything is controlled from admin → Cute AI Guide.
   =================================================================== */

(function () {
  'use strict';

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCuteAgent);
  } else {
    initCuteAgent();
  }

  function initCuteAgent() {
    const C = window.SITE || window.SITE_CONTENT || {};
    const cfg = Object.assign({
      enabled: true,
      name: 'Mochi 🧚',
      avatar: 'fairy',
      customAvatarUrl: '',
      personality: 'sweet',
      welcomeMsg: 'Assalam-o-Alaikum Ifra! 🌹 I am your little love guider made by Tayyab. Tap me anytime for a magical tour, secrets, or a smile! ✨',
      welcomeScreen: true,
      welcomeTitle: 'Assalam-o-Alaikum, {name} 🌹',
      welcomeBackTitle: 'Welcome back, {name} 💕',
      finalNote: 'That was everything! Thank you for letting me show you around. Tayyab put his whole heart into every corner of this place. 🌹',
      survey: true,
      smallTalk: true,
      autoStartTour: false,
      useCustomTour: false,
      ambientTips: true,
      sound: true,
      position: 'bottom-right',
      tour: [],
      sections: [],
      notes: [],
      qa: []
    }, C.agent || {});

    if (cfg.enabled === false) return;
    const Brain = window.AgentBrain || null;
    const LITE_MODE = document.documentElement.classList.contains('lite') || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    const HER = ((document.querySelector('.rose-name') || {}).textContent || (C.text && C.text.roseName) || 'Ifra').trim() || 'Ifra';
    const AGENT_FIRST = String(cfg.name || 'Mochi').replace(/\s*[^\w\s].*$/, '').trim() || 'Mochi';

    /* ---------- saved progress (this phone only) ---------- */
    const GK = 'ifraGuide';
    let G = { visits: 0, step: 0, done: {}, react: {}, answers: {}, completed: false };
    try { G = Object.assign(G, JSON.parse(localStorage.getItem(GK) || '{}') || {}); } catch (e) { }
    function saveG() { try { localStorage.setItem(GK, JSON.stringify(G)); } catch (e) { } }
    const returning = G.visits > 0;
    G.visits = (G.visits || 0) + 1; saveG();

    // Build DOM
    const container = document.createElement('div');
    container.id = 'cuteAgentContainer';
    container.className = cfg.position === 'bottom-left' ? 'pos-bl' : 'pos-br';

    // Restore saved position if any
    try {
      const savedPos = JSON.parse(localStorage.getItem('ifraAgentPos') || 'null');
      if (savedPos && typeof savedPos.x === 'number' && typeof savedPos.y === 'number') {
        const maxX = window.innerWidth - 85;
        const maxY = window.innerHeight - 85;
        const x = Math.max(10, Math.min(savedPos.x, maxX));
        const y = Math.max(10, Math.min(savedPos.y, maxY));
        container.style.left = x + 'px';
        container.style.top = y + 'px';
        container.style.right = 'auto';
        container.style.bottom = 'auto';
      }
    } catch (e) { }

    const diaryOff = C.diary && C.diary.enabled === false;
    const plannerOff = C.planner && C.planner.enabled === false;

    container.innerHTML = `
      <div class="agent-character-wrap" id="agentCharacter" role="button" tabindex="0" aria-label="Cute AI Guide">
        <div class="agent-halo"></div>
        <div id="agentAvatarHost" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;"></div>
        <div class="agent-status-badge" id="agentBadge" style="display:none">1</div>
      </div>
      <div class="agent-ambient-tip" id="agentAmbientTip" style="display:none"></div>
      <div class="agent-bubble-window" id="agentBubble" role="dialog" aria-label="${escapeHtml(cfg.name)}">
        <div class="agent-bubble-tail"></div>
        <div class="agent-b-head">
          <div class="agent-b-icon">✨</div>
          <div class="agent-b-title-wrap">
            <div class="agent-b-name" id="agentTitleName">${escapeHtml(cfg.name)}</div>
            <div class="agent-b-sub">Your Personal Love Guider 💕</div>
          </div>
          <button class="agent-b-close" id="agentCloseBtn" aria-label="Close" type="button">&times;</button>
        </div>
        <div class="agent-b-body" id="agentBody">
          <div class="agent-speech-bubble" id="agentSpeech">${escapeHtml(cfg.welcomeMsg)}</div>
          <div id="agentDynamicContent"></div>
          <div class="agent-actions-grid" id="agentActionsGrid">
            <button class="agent-act-btn full-w" type="button" id="actTour">✨ Show Me Around</button>
            <button class="agent-act-btn" type="button" id="actChat">💬 Ask Me Anything</button>
            <button class="agent-act-btn" type="button" id="actJump">🧭 Jump to a Section</button>
            <button class="agent-act-btn" type="button" id="actPlan"${plannerOff ? ' style="display:none"' : ''}>📅 Plan a Date</button>
            <button class="agent-act-btn" type="button" id="actDiary"${diaryOff ? ' style="display:none"' : ''}>📖 My Diary</button>
            <button class="agent-act-btn" type="button" id="actWhisper">💌 Love Note</button>
            <button class="agent-act-btn" type="button" id="actSurprise">🎁 Surprises</button>
            <button class="agent-act-btn" type="button" id="actMusic">🎵 Play Song</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(container);

    // Elements
    const charWrap = document.getElementById('agentCharacter');
    const avatarHost = document.getElementById('agentAvatarHost');
    const bubbleWin = document.getElementById('agentBubble');
    const closeBtn = document.getElementById('agentCloseBtn');
    const speechEl = document.getElementById('agentSpeech');
    const dynamicEl = document.getElementById('agentDynamicContent');
    const actionsGrid = document.getElementById('agentActionsGrid');
    const badgeEl = document.getElementById('agentBadge');
    const ambientTipEl = document.getElementById('agentAmbientTip');

    renderAvatar(avatarHost, cfg);

    // Sparkle Particles Loop
    setInterval(() => {
      if (document.hidden) return;
      createSparkle(charWrap);
    }, 2800);

    // State
    let isBubbleOpen = false;
    let steps = [];
    let tourIndex = -1;          // -1 = no journey running
    let activeSpotlight = null;
    let spotRestore = null;
    let view = 'menu';
    let chatLog = [];

    /* ---------- sound ---------- */
    function playChime() {
      if (!cfg.sound) return;
      if (!window.AudioContext && !window.webkitAudioContext) return;
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === 'suspended') ctx.resume();
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.07);
          gain.gain.setValueAtTime(0.035, ctx.currentTime + idx * 0.07);
          gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + idx * 0.07 + 0.32);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + idx * 0.07);
          osc.stop(ctx.currentTime + idx * 0.07 + 0.32);
        });
      } catch (e) { }
    }

    /* ---------- bubble open / close ---------- */
    function openBubble() {
      bubbleWin.classList.add('open');
      isBubbleOpen = true;
      badgeEl.style.display = 'none';
      hideAmbientTip();
      playChime();
    }
    function closeBubble() {                 // keeps a running journey so she can come back to it
      bubbleWin.classList.remove('open');
      isBubbleOpen = false;
    }
    function toggleBubble() {
      if (isBubbleOpen) closeBubble();
      else openBubble();
    }
    closeBtn.addEventListener('click', (e) => { e.stopPropagation(); closeBubble(); });

    // Touch & Mouse Dragging Physics
    let isDragging = false;
    let startX = 0, startY = 0;
    let initialLeft = 0, initialTop = 0;
    let dragDistance = 0;

    charWrap.addEventListener('mousedown', onDragStart);
    charWrap.addEventListener('touchstart', onDragStart, { passive: false });
    charWrap.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleBubble(); } });

    function onDragStart(e) {
      if (e.target.closest('.agent-b-close')) return;
      const evt = e.touches ? e.touches[0] : e;
      isDragging = true;
      dragDistance = 0;
      startX = evt.clientX;
      startY = evt.clientY;
      const rect = container.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;
      window.addEventListener('mousemove', onDragMove);
      window.addEventListener('mouseup', onDragEnd);
      window.addEventListener('touchmove', onDragMove, { passive: false });
      window.addEventListener('touchend', onDragEnd);
    }
    function onDragMove(e) {
      if (!isDragging) return;
      const evt = e.touches ? e.touches[0] : e;
      const dx = evt.clientX - startX;
      const dy = evt.clientY - startY;
      dragDistance = Math.hypot(dx, dy);
      if (dragDistance > 5) {
        if (e.cancelable) e.preventDefault();
        container.style.right = 'auto';
        container.style.bottom = 'auto';
        container.style.left = Math.max(10, Math.min(window.innerWidth - 85, initialLeft + dx)) + 'px';
        container.style.top = Math.max(10, Math.min(window.innerHeight - 85, initialTop + dy)) + 'px';
      }
    }
    function onDragEnd() {
      if (!isDragging) return;
      isDragging = false;
      window.removeEventListener('mousemove', onDragMove);
      window.removeEventListener('mouseup', onDragEnd);
      window.removeEventListener('touchmove', onDragMove);
      window.removeEventListener('touchend', onDragEnd);
      if (dragDistance < 6) {
        toggleBubble();
      } else {
        try {
          const rect = container.getBoundingClientRect();
          localStorage.setItem('ifraAgentPos', JSON.stringify({ x: rect.left, y: rect.top }));
        } catch (e) { }
      }
    }

    /* ---------- tiny view helpers ---------- */
    function E(s) { return escapeHtml(s); }
    function fmt(t) { return Brain ? Brain.html(t) : E(t); }
    function say(html) { speechEl.innerHTML = html; }
    function setView(v) { view = v; bubbleWin.setAttribute('data-view', v); }
    function showMenu() {
      clearSpotlight();
      tourIndex = -1;
      setView('menu');
      dynamicEl.innerHTML = '';
      actionsGrid.style.display = 'grid';
      const resume = G.step > 0 && !G.completed;
      document.getElementById('actTour').textContent = resume ? '✨ Continue the Journey' : (G.completed ? '✨ Take the Journey Again' : '✨ Show Me Around');
      say(E(cfg.welcomeMsg));
    }
    function hideMenu() { actionsGrid.style.display = 'none'; }
    function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

    /* ---------- spotlight on the part of the page we are talking about ---------- */
    function clearSpotlight() {
      if (activeSpotlight) {
        activeSpotlight.classList.remove('agent-tour-spotlight');
        if (spotRestore !== null) activeSpotlight.style.position = spotRestore;
      }
      activeSpotlight = null; spotRestore = null;
    }
    function findTarget(sel) {
      if (!sel) return null;
      const list = Array.isArray(sel) ? sel : [sel];
      for (const s of list) { try { const el = document.querySelector(s); if (el) return el; } catch (e) { } }
      return null;
    }
    function spotlight(sel) {
      clearSpotlight();
      const el = findTarget(sel);
      if (!el) return null;
      if (getComputedStyle(el).position === 'static') { spotRestore = el.style.position; el.style.position = 'relative'; }
      el.classList.add('agent-tour-spotlight');
      activeSpotlight = el;
      try { el.scrollIntoView({ behavior: LITE_MODE ? 'auto' : 'smooth', block: 'center' }); } catch (e) { }
      return el;
    }

    /* ---------- running a "try it" button, then coming back afterwards ---------- */
    let backTimer = null;
    function watchReturn(onBack) {
      clearInterval(backTimer);
      let sawOpen = false, quiet = 0, ticks = 0;
      backTimer = setInterval(() => {
        ticks++;
        const open = Brain && Brain.overlayOpen();
        if (open) { sawOpen = true; quiet = 0; }
        else quiet++;
        if ((sawOpen && quiet >= 2) || (!sawOpen && ticks >= 8) || ticks > 1200) {
          clearInterval(backTimer);
          onBack();
        }
      }, 700);
    }
    function doAct(act, fromStep) {
      if (!Brain) return;
      if (act === 'next') { nextStep(); return; }
      if (act === 'tour') { startJourney(); return; }
      if (act === 'whisper') { whisper(); return; }
      if (act.indexOf('goto:') === 0) { gotoSection(act.slice(5)); return; }
      if (act.indexOf('tiles:') === 0) { showDirectory(act.slice(6)); return; }
      if (act.indexOf('ask:') === 0) { askTayyab(act.slice(4)); return; }
      const r = Brain.run(act);
      if (r === 'modal') {
        closeBubble();
        watchReturn(() => {
          if (tourIndex >= 0 && fromStep) {
            showAmbientTip('Welcome back! Tap me to continue the tour ✨');
          } else {
            showAmbientTip('Anything else? I’m right here 🌸');
          }
        });
      } else if (r === 'ok' && fromStep) {
        // an inline action (play, switch look...): keep the bubble open
      } else if (r === false) {
        toastSay('Hmm, I can’t find that on this page right now. 🌸');
      }
    }
    function toastSay(t) {
      const n = document.createElement('div'); n.className = 'ag-note'; n.textContent = t;
      dynamicEl.appendChild(n); setTimeout(() => n.remove(), 3500);
    }
    function askTayyab(q) {
      try { if (typeof writebackPrefill !== 'undefined') writebackPrefill = 'A question for you, Tayyab: ' + q + '\n'; } catch (e) { }
      doAct('tile:writeback', false);
    }

    /* ===============================================================
       WELCOME (right after she taps the rose)
       =============================================================== */
    let welcomeEl = null;
    function greetingByTime() {
      const h = new Date().getHours();
      return h < 5 ? 'It’s late, and you’re still here with me 🌙' : h < 12 ? 'A soft good morning to you ☀️' : h < 17 ? 'A gentle afternoon for you 🌤️' : h < 21 ? 'A calm evening, just for you 🌆' : 'A quiet night, just for you 🌙';
    }
    function insideChips() {
      const chips = [];
      if (!Brain) return chips;
      const secs = Brain.sections();
      const has = id => secs.some(s => s.id === id);
      const songs = (C.songs || []).filter(s => s && s.file).length;
      if (songs) chips.push(['🎶', songs + (songs === 1 ? ' song' : ' songs')]);
      const env = document.querySelectorAll('.envelope').length;
      if (env) chips.push(['💌', env + (env === 1 ? ' letter' : ' letters')]);
      const st = Brain.tiles('surprises').length;
      if (st) chips.push(['🎁', st + ' surprises']);
      const pg = Brain.tiles('play').length;
      if (pg) chips.push(['🎮', pg + (pg === 1 ? ' game' : ' games')]);
      if (has('diary')) chips.push(['📖', 'your diary']);
      if (has('planner')) chips.push(['📅', 'plan a date']);
      return chips.slice(0, 6);
    }
    function showWelcome() {
      if (welcomeEl || cfg.welcomeScreen === false) { return false; }
      const title = (returning && G.visits > 1 ? cfg.welcomeBackTitle : cfg.welcomeTitle).replace(/\{name\}/g, HER);
      const resume = G.step > 0 && !G.completed;
      const first = !returning;
      const chips = insideChips().map(c => `<span class="agw-chip"><i>${c[0]}</i>${E(c[1])}</span>`).join('');
      const primary = resume ? '✨ Continue where I left off' : (G.completed ? '✨ Take the journey again' : '✨ Show me around');
      welcomeEl = document.createElement('div');
      welcomeEl.className = 'agent-welcome';
      welcomeEl.setAttribute('role', 'dialog');
      welcomeEl.setAttribute('aria-modal', 'true');
      welcomeEl.setAttribute('aria-label', 'Welcome');
      welcomeEl.innerHTML = `
        <div class="agw-card">
          <div class="agw-av" id="agwAv"><div class="agw-halo"></div><div class="agw-avhost" id="agwAvHost"></div></div>
          <h2 class="agw-title">${E(title)}</h2>
          <p class="agw-time">${E(greetingByTime())}</p>
          <p class="agw-msg" id="agwMsg"></p>
          ${first && chips ? `<div class="agw-inside"><span class="agw-lbl">Inside, you’ll find</span><div class="agw-chips">${chips}</div></div>` : ''}
          <div class="agw-btns">
            <button type="button" class="agw-go" id="agwGo">${primary}</button>
            <button type="button" class="agw-skip" id="agwSkip">${first ? 'I’ll explore on my own' : 'Not now'}</button>
          </div>
          <p class="agw-foot">${E(AGENT_FIRST)} · your little guide</p>
        </div>`;
      document.body.appendChild(welcomeEl);
      renderAvatar(welcomeEl.querySelector('#agwAvHost'), cfg);
      requestAnimationFrame(() => welcomeEl && welcomeEl.classList.add('show'));
      playChime();
      try { if (typeof burstCenter === 'function' && !LITE_MODE) burstCenter(14); } catch (e) { }

      // the one orchestrated moment: the message types itself out
      const msgEl = welcomeEl.querySelector('#agwMsg');
      const text = returning && !resume
        ? 'It’s so good to see you again. Come in, the roses are still here. If you want, I can show you anything you missed. 🌸'
        : resume ? 'Welcome back! We stopped in the middle of the journey. Shall we carry on from there? 🌸' : cfg.welcomeMsg;
      if (LITE_MODE) msgEl.textContent = text;
      else {
        let i = 0; const step = Math.max(1, Math.round(text.length / 70));
        (function type() {
          if (!welcomeEl) return;
          i += step; msgEl.textContent = text.slice(0, i);
          if (i < text.length) setTimeout(type, 28);
        })();
      }

      const go = welcomeEl.querySelector('#agwGo'), skip = welcomeEl.querySelector('#agwSkip');
      function leave(cb) {
        if (!welcomeEl) return;
        const w = welcomeEl; welcomeEl = null;
        w.classList.remove('show'); w.classList.add('out');
        document.removeEventListener('keydown', onKey, true);
        setTimeout(() => { w.remove(); if (cb) cb(); }, LITE_MODE ? 0 : 380);
      }
      function onKey(e) { if (e.key === 'Escape') { e.stopPropagation(); leave(afterSkip); } }
      function afterSkip() {
        showAmbientTip(first ? 'I’m here if you want a tour. Just tap me 🌸' : 'Tap me anytime 🌸');
      }
      go.onclick = () => leave(() => { openBubble(); startJourney(); });
      skip.onclick = () => leave(afterSkip);
      document.addEventListener('keydown', onKey, true);
      setTimeout(() => { try { go.focus({ preventScroll: true }); } catch (e) { } }, 450);
      return true;
    }

    // wait for the rose to be tapped, let the card appear, then welcome her
    (function waitForRose() {
      let seenAt = 0, tries = 0;
      const iv = setInterval(() => {
        tries++;
        let opened = false;
        try { opened = (typeof roseOpened !== 'undefined') ? !!roseOpened : false; } catch (e) { }
        const rose = document.getElementById('roseScreen');
        if (!rose) opened = true;
        if (opened && !seenAt) seenAt = Date.now();
        if (opened && Date.now() - seenAt >= (rose ? 4300 : 800)) {
          clearInterval(iv);
          const shown = showWelcome();
          if (!shown) setTimeout(() => { if (!isBubbleOpen) openBubble(); }, 600);
          else if (cfg.autoStartTour && !returning) { /* handled by her tapping the big button; kept for admin flag */ }
        }
        if (tries > 3000) clearInterval(iv);
      }, 400);
    })();

    /* ===============================================================
       THE JOURNEY (section by section, with a little survey)
       =============================================================== */
    function legacySteps() {
      return (cfg.tour || []).filter(s => s && s.target).map((s, i) => ({
        id: s.id || ('stop' + i), icon: '✨', sel: s.target, title: s.title || 'Stop ' + (i + 1), what: s.text || '', how: [], tip: '', q: '', opts: [], ask: []
      }));
    }
    function loadSteps() {
      if (cfg.useCustomTour && cfg.tour && cfg.tour.length) return legacySteps();
      return Brain ? Brain.sections() : legacySteps();
    }

    function startJourney(from) {
      steps = loadSteps();
      if (!steps.length) { say(E('There is nothing to show yet.')); return; }
      if (!isBubbleOpen) openBubble();
      let i = (typeof from === 'number') ? from : (G.step > 0 && !G.completed && G.step < steps.length ? G.step : 0);
      if (G.completed && typeof from !== 'number') { i = 0; G.completed = false; G.done = {}; G.react = {}; G.answers = {}; }
      hideMenu();
      showStep(i);
    }
    function gotoSection(id) {
      steps = loadSteps();
      const i = steps.findIndex(s => s.id === id);
      if (i < 0) return;
      if (!isBubbleOpen) openBubble();
      hideMenu();
      showStep(i, true);
    }

    function showStep(idx, single) {
      if (idx < 0) idx = 0;
      if (idx >= steps.length) { showSummary(); return; }
      tourIndex = idx; setView('step');
      const st = steps[idx];
      if (!single) { G.step = idx; saveG(); }
      spotlight(st.sel);

      const pct = Math.round(((idx + 1) / steps.length) * 100);
      say(`
        ${single ? '' : `<div class="ag-prog" aria-label="Step ${idx + 1} of ${steps.length}"><span style="width:${pct}%"></span></div>`}
        <div class="ag-h"><span class="ag-ic">${E(st.icon || '✨')}</span><b>${E(st.title)}</b></div>
        <p class="ag-what">${E(st.what)}</p>
        ${st.how && st.how.length ? `<details class="ag-how"><summary>How it works</summary><ol>${st.how.map(h => `<li>${E(h)}</li>`).join('')}</ol></details>` : ''}
        ${st.tip ? `<p class="ag-tip">💡 ${E(st.tip)}</p>` : ''}
      `);

      let ctl = '';
      if (cfg.survey !== false && st.q) {
        const prev = G.answers[st.id];
        ctl += `<div class="ag-q"><div class="ag-qt">${E(st.q)}</div><div class="ag-opts">${(st.opts || []).map((o, k) =>
          `<button type="button" class="ag-opt${prev === o.l ? ' on' : ''}" data-k="${k}">${E(o.l)}</button>`).join('')}</div><div class="ag-reply" id="agReply"></div></div>`;
      }
      if (cfg.survey !== false && !single) {
        const r = G.react[st.id];
        ctl += `<div class="ag-react"><span>How does this part feel?</span>${[['😍', 'love'], ['🙂', 'ok'], ['😐', 'meh']].map(x =>
          `<button type="button" class="ag-rx${r === x[1] ? ' on' : ''}" data-r="${x[1]}" aria-label="${x[1]}">${x[0]}</button>`).join('')}</div>`;
      }
      ctl += `<div class="agent-tour-bar">
          ${single ? '' : `<span class="agent-tour-step">Step ${idx + 1} of ${steps.length}</span>`}
          <div class="agent-tour-ctrls">
            ${single ? `<button class="agent-tour-btn" id="tourMenu">⬅️ Menu</button>` : (idx > 0 ? '<button class="agent-tour-btn" id="tourPrev">⬅️</button>' : '')}
            <button class="agent-tour-btn" id="tourPeek" title="Hide me for a moment">👁 Peek</button>
            ${single ? '' : `<button class="agent-tour-btn next" id="tourNext">${idx < steps.length - 1 ? 'Next ➡️' : 'Finish ✨'}</button>`}
            <button class="agent-tour-btn" id="tourExit">✕</button>
          </div>
        </div>`;
      dynamicEl.innerHTML = ctl;
      playChime();

      dynamicEl.querySelectorAll('.ag-opt').forEach(b => {
        b.onclick = () => {
          const o = st.opts[Number(b.dataset.k)];
          if (!o) return;
          G.answers[st.id] = o.l; G.done[st.id] = 1; saveG();
          dynamicEl.querySelectorAll('.ag-opt').forEach(x => x.classList.toggle('on', x === b));
          if (o.reply) { const rp = document.getElementById('agReply'); if (rp) rp.textContent = o.reply; }
          if (o.act) doAct(o.act, !single);
        };
      });
      dynamicEl.querySelectorAll('.ag-rx').forEach(b => {
        b.onclick = () => {
          G.react[st.id] = b.dataset.r; G.done[st.id] = 1; saveG();
          dynamicEl.querySelectorAll('.ag-rx').forEach(x => x.classList.toggle('on', x === b));
          try { if (b.dataset.r === 'love' && typeof burstOn === 'function' && !LITE_MODE) burstOn(b, 6); } catch (e) { }
        };
      });
      const byId = id => document.getElementById(id);
      if (byId('tourNext')) byId('tourNext').onclick = nextStep;
      if (byId('tourPrev')) byId('tourPrev').onclick = () => showStep(tourIndex - 1);
      if (byId('tourMenu')) byId('tourMenu').onclick = showMenu;
      byId('tourExit').onclick = () => { showMenu(); };
      byId('tourPeek').onclick = () => { closeBubble(); showAmbientTip('Tap me when you’re ready to go on ✨'); };
      const body = document.getElementById('agentBody'); if (body) body.scrollTop = 0;
    }
    function nextStep() {
      const st = steps[tourIndex];
      if (st) { G.done[st.id] = 1; saveG(); }
      showStep(tourIndex + 1);
    }

    function showSummary() {
      clearSpotlight();
      tourIndex = steps.length;
      setView('summary');
      G.completed = true; G.step = 0; saveG();
      const loved = steps.filter(s => G.react[s.id] === 'love');
      const explored = steps.filter(s => G.done[s.id]).length;
      const chips = loved.map(s => `<span class="ag-chip-on">${E(s.icon || '')} ${E(s.title)}</span>`).join('');
      say(`
        <div class="ag-h"><span class="ag-ic">🎉</span><b>We made it, ${E(HER)}!</b></div>
        <p class="ag-what">${E(cfg.finalNote)}</p>
        <p class="ag-what">You explored <b>${explored}</b> of <b>${steps.length}</b> places.${loved.length ? ' You loved:' : ''}</p>
        ${chips ? `<div class="ag-chips">${chips}</div>` : ''}
      `);
      dynamicEl.innerHTML = `
        <div class="ag-opts col">
          ${cfg.survey !== false ? `<button type="button" class="ag-opt solid" id="sumSend">💌 Tell ${E('Tayyab')} what I loved</button>` : ''}
          <button type="button" class="ag-opt" id="sumChat">💬 Ask me anything</button>
          <button type="button" class="ag-opt" id="sumAgain">🔁 Start again</button>
          <button type="button" class="ag-opt" id="sumClose">✕ Done</button>
        </div>`;
      playChime();
      try { if (typeof burstCenter === 'function' && !LITE_MODE) burstCenter(16); } catch (e) { }
      const by = id => document.getElementById(id);
      if (by('sumSend')) by('sumSend').onclick = () => {
        const L = steps.filter(s => G.react[s.id] === 'love').map(s => s.title);
        const M = steps.filter(s => G.react[s.id] === 'meh').map(s => s.title);
        let msg = 'I just finished the tour you made for me 🌹\n';
        msg += L.length ? 'The parts I loved most: ' + L.join(', ') + '.\n' : 'I explored everything, and it was beautiful.\n';
        if (M.length) msg += 'Not my favourite: ' + M.join(', ') + '.\n';
        msg += 'Thank you for all of this 💕';
        try { if (typeof writebackPrefill !== 'undefined') writebackPrefill = msg; } catch (e) { }
        doAct('tile:writeback', false);
      };
      by('sumChat').onclick = () => showChat();
      by('sumAgain').onclick = () => { G.done = {}; G.react = {}; G.answers = {}; G.completed = false; saveG(); startJourney(0); };
      by('sumClose').onclick = () => { showMenu(); closeBubble(); };
    }

    /* ===============================================================
       JUMP TO A SECTION + TILE DIRECTORY
       =============================================================== */
    function showJump() {
      clearSpotlight(); steps = loadSteps(); setView('jump');
      hideMenu();
      say(`<div class="ag-h"><span class="ag-ic">🧭</span><b>Where would you like to go?</b></div><p class="ag-what">Pick a place and I’ll take you there and explain it.</p>`);
      dynamicEl.innerHTML = `<div class="ag-jump">${steps.map(s => `<button type="button" class="ag-j" data-id="${E(s.id)}"><span>${E(s.icon || '✨')}</span>${E(s.title)}</button>`).join('')}</div>
        <div class="agent-tour-bar"><div class="agent-tour-ctrls"><button class="agent-tour-btn" id="jumpBack">⬅️ Menu</button></div></div>`;
      dynamicEl.querySelectorAll('.ag-j').forEach(b => { b.onclick = () => gotoSection(b.dataset.id); });
      document.getElementById('jumpBack').onclick = showMenu;
    }
    function showDirectory(group) {
      if (!Brain) return;
      clearSpotlight(); setView('dir'); hideMenu();
      const list = Brain.tiles(group === 'play' ? 'play' : 'surprises');
      say(`<div class="ag-h"><span class="ag-ic">${group === 'play' ? '🎮' : '🎁'}</span><b>${group === 'play' ? 'The games' : 'The little surprises'}</b></div><p class="ag-what">Tap “Try” to open any of them.</p>`);
      dynamicEl.innerHTML = `<div class="ag-dir">${list.map(t => `
        <div class="ag-d"><div class="ag-dh"><span>${E(t.icon)}</span><b>${E(t.label)}${t.locked ? ' 🔒' : ''}</b><button type="button" class="ag-try" data-a="${E(t.act)}">Try</button></div><p>${E(t.line)}</p></div>`).join('')}</div>
        <div class="agent-tour-bar"><div class="agent-tour-ctrls"><button class="agent-tour-btn" id="dirBack">⬅️ Back</button></div></div>`;
      dynamicEl.querySelectorAll('.ag-try').forEach(b => { b.onclick = () => doAct(b.dataset.a, false); });
      document.getElementById('dirBack').onclick = () => { if (tourIndex >= 0) showStep(tourIndex); else showMenu(); };
    }

    /* ===============================================================
       CHAT
       =============================================================== */
    function showChat(first) {
      clearSpotlight(); setView('chat'); hideMenu();
      if (!chatLog.length) {
        chatLog.push({ who: 'bot', t: 'Ask me anything about this website, ' + HER + '! How things work, where to find them, what Tayyab can see… I’ll show you, too. 🌸' });
      }
      say(`<div class="ag-h"><span class="ag-ic">💬</span><b>Chat with ${E(AGENT_FIRST)}</b></div>`);
      const sug = Brain ? Brain.suggestions(tourIndex >= 0 && steps[tourIndex] ? steps[tourIndex].id : '') : [];
      dynamicEl.innerHTML = `
        <div class="ag-log" id="agLog" aria-live="polite"></div>
        <div class="agent-chat-chips" id="agChips">${sug.map(q => `<span class="agent-chip" role="button" tabindex="0">${E(q)}</span>`).join('')}</div>
        <div class="agent-chat-input-bar">
          <input type="text" class="agent-chat-input" id="agentChatInp" placeholder="Ask a question..." autocomplete="off" maxlength="200" />
          <button class="agent-chat-send" id="agentChatBtn" type="button" aria-label="Send">➤</button>
        </div>
        <button class="agent-tour-btn" id="agentChatBack" style="align-self:flex-start;margin-top:6px;">⬅️ Menu</button>`;
      renderLog();
      const inp = document.getElementById('agentChatInp');
      document.getElementById('agentChatBtn').onclick = () => send(inp.value);
      inp.onkeydown = e => { if (e.key === 'Enter') send(inp.value); };
      document.querySelectorAll('#agChips .agent-chip').forEach(c => {
        c.onclick = () => send(c.textContent);
        c.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); send(c.textContent); } };
      });
      document.getElementById('agentChatBack').onclick = () => { if (tourIndex >= 0) showStep(tourIndex); else showMenu(); };
      if (typeof first === 'string' && first) send(first);
    }
    function renderLog() {
      const log = document.getElementById('agLog'); if (!log) return;
      log.innerHTML = chatLog.slice(-14).map((m, i, arr) => {
        let h = `<div class="ag-m ${m.who}"><div class="ag-mb">${m.who === 'me' ? E(m.t) : fmt(m.t)}</div>`;
        if (m.who === 'bot' && m.acts && m.acts.length) h += `<div class="ag-ma">${m.acts.map(a => `<button type="button" class="ag-act" data-a="${E(a.a)}">${E(a.l)}</button>`).join('')}</div>`;
        if (m.who === 'bot' && m.f && m.f.length && i === arr.length - 1) h += `<div class="ag-mf">${m.f.map(q => `<span class="agent-chip" role="button" tabindex="0">${E(q)}</span>`).join('')}</div>`;
        return h + '</div>';
      }).join('');
      log.querySelectorAll('.ag-act').forEach(b => { b.onclick = () => doAct(b.dataset.a, false); });
      log.querySelectorAll('.ag-mf .agent-chip').forEach(c => { c.onclick = () => send(c.textContent); });
      log.scrollTop = log.scrollHeight;
      const body = document.getElementById('agentBody'); if (body) body.scrollTop = body.scrollHeight;
    }
    function send(raw) {
      const val = String(raw || '').trim();
      const inp = document.getElementById('agentChatInp');
      if (!val) return;
      if (inp) inp.value = '';
      chatLog.push({ who: 'me', t: val });
      chatLog.push({ who: 'typing', t: '' });
      renderTyping();
      setTimeout(() => {
        chatLog = chatLog.filter(m => m.who !== 'typing');
        let r = null;
        try { r = Brain ? Brain.answer(val, { sections: steps.length ? steps : undefined }) : null; } catch (e) { r = null; }
        if (!r) r = { t: 'Everything on this website was crafted just for you, ' + HER + '. ❤️', acts: [], f: [] };
        chatLog.push({ who: 'bot', t: r.t, acts: r.acts, f: r.f });
        renderLog(); playChime();
      }, LITE_MODE ? 60 : 420);
    }
    function renderTyping() {
      const log = document.getElementById('agLog'); if (!log) return;
      renderLog();
      log.insertAdjacentHTML('beforeend', '<div class="ag-m bot"><div class="ag-mb ag-dots"><i></i><i></i><i></i></div></div>');
      log.scrollTop = log.scrollHeight;
    }

    /* ---------- menu buttons ---------- */
    document.getElementById('actTour').onclick = () => startJourney();
    document.getElementById('actChat').onclick = () => showChat();
    document.getElementById('actJump').onclick = showJump;

    const notesList = (cfg.notes && cfg.notes.length) ? cfg.notes : [
      "Ifra, your smile makes even the dullest days feel like pure magic ✨",
      "You are Tayyab's favourite thought, morning and night 🌙",
      "Your laugh is Tayyab's absolute favourite sound in the whole universe 🎶",
      "You are not just his choice, you are his answered prayer 🌹"
    ];
    function whisper() {
      const note = notesList[Math.floor(Math.random() * notesList.length)];
      say(`💌 <b>A whisper from Tayyab:</b><br><br>“${E(note)}”`);
      burstHearts(charWrap);
      playChime();
    }

    document.getElementById('actPlan').onclick = () => { closeBubble(); doAct('tile:calendar', false); };
    const dBtn = document.getElementById('actDiary');
    if (dBtn) dBtn.onclick = () => { closeBubble(); doAct('click:#diaryBtn', false); };
    document.getElementById('actWhisper').onclick = whisper;
    document.getElementById('actSurprise').onclick = () => {
      const s = document.querySelector('.surprises-section');
      if (s) s.scrollIntoView({ behavior: 'smooth', block: 'center' });
      showDirectory('surprises');
    };
    document.getElementById('actMusic').onclick = () => {
      if (Brain) Brain.run('player:play');
      say(`🎶 <b>Music time!</b><br><br>Tap the song name in the player to choose another one. 💕`);
      playChime();
    };

    /* ---------- ambient tips (scrolling near sections) ---------- */
    if (cfg.ambientTips && 'IntersectionObserver' in window) {
      const shownTips = new Set();
      const tips = [
        { sel: '.gallery-section', text: '📸 Tap any photo to see it full-screen with its caption!' },
        { sel: '.letters-section', text: '💌 Open an envelope whenever your heart needs a little warmth!' },
        { sel: '.surprises-section', text: '🎁 Every tile hides a surprise. Want me to explain them?' },
        { sel: '.tile-grid.three', text: '🎮 Mini games to play together. Wins earn ⭐ for your Love Jar!' },
        { sel: '.proposal-section', text: '💍 One special question is waiting here for you…' }
      ];
      const obs = new IntersectionObserver((entries) => {
        if (isBubbleOpen || welcomeEl) return;
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const tip = tips.find(t => entry.target.matches(t.sel));
            if (tip && !shownTips.has(tip.sel)) { shownTips.add(tip.sel); showAmbientTip(tip.text); }
          }
        });
      }, { threshold: 0.35 });
      tips.forEach(t => { const el = document.querySelector(t.sel); if (el) obs.observe(el); });
    }
    let tipTimer = null;
    function showAmbientTip(text) {
      if (isBubbleOpen || welcomeEl) return;
      ambientTipEl.innerHTML = `<span>✨ ${E(text)}</span>`;
      ambientTipEl.style.display = 'block';
      badgeEl.style.display = 'flex';
      clearTimeout(tipTimer);
      tipTimer = setTimeout(hideAmbientTip, 6500);
    }
    function hideAmbientTip() { ambientTipEl.style.display = 'none'; }
    ambientTipEl.onclick = () => { hideAmbientTip(); openBubble(); };

    showMenu();
    // let other scripts (or the console) talk to the guide
    window.CuteAgent = { open: openBubble, close: closeBubble, tour: startJourney, chat: showChat, jump: showJump };
  }

  // Helper: Create Floating Sparkle
  function createSparkle(parent) {
    const s = document.createElement('span');
    s.className = 'agent-sparkle';
    const emojis = ['✨', '💖', '🌸', '⭐', '💕', '🌷'];
    s.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    s.style.setProperty('--rx', (Math.random() * 40 - 20).toFixed(0));
    s.style.left = (Math.random() * 40 + 15) + '%';
    s.style.top = (Math.random() * 30 + 10) + '%';
    parent.appendChild(s);
    setTimeout(() => s.remove(), 2200);
  }

  function burstHearts(parent) {
    for (let i = 0; i < 5; i++) {
      setTimeout(() => createSparkle(parent), i * 150);
    }
  }

  // Render SVG Avatars
  function renderAvatar(host, cfg) {
    host.innerHTML = '';
    const av = cfg.avatar || 'fairy';

    if (av === 'custom' && cfg.customAvatarUrl) {
      const img = document.createElement('img');
      img.src = cfg.customAvatarUrl;
      img.alt = cfg.name || 'AI Guide';
      img.className = 'agent-avatar-img';
      host.appendChild(img);
      return;
    }

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('class', 'agent-avatar-svg');

    if (av === 'bear') {
      svg.innerHTML = `
        <!-- Teddy Bear Avatar -->
        <defs>
          <radialGradient id="bearBody" cx="50%" cy="45%" r="50%">
            <stop offset="0%" stop-color="#d49b6a"/>
            <stop offset="100%" stop-color="#9e663a"/>
          </radialGradient>
        </defs>
        <!-- Ears -->
        <circle cx="24" cy="26" r="14" fill="#9e663a"/>
        <circle cx="24" cy="26" r="8" fill="#f8b4c4"/>
        <circle cx="76" cy="26" r="14" fill="#9e663a"/>
        <circle cx="76" cy="26" r="8" fill="#f8b4c4"/>
        <!-- Head -->
        <circle cx="50" cy="50" r="38" fill="url(#bearBody)"/>
        <!-- Snout -->
        <ellipse cx="50" cy="58" rx="15" ry="12" fill="#fdead9"/>
        <!-- Nose -->
        <ellipse cx="50" cy="53" rx="5" ry="3.5" fill="#4a2810"/>
        <!-- Smile -->
        <path d="M 46 59 Q 50 63 54 59" stroke="#4a2810" stroke-width="2" fill="none" stroke-linecap="round"/>
        <!-- Eyes -->
        <circle cx="37" cy="46" r="4.5" fill="#2d1506"/>
        <circle cx="38.5" cy="44.5" r="1.5" fill="#fff"/>
        <circle cx="63" cy="46" r="4.5" fill="#2d1506"/>
        <circle cx="64.5" cy="44.5" r="1.5" fill="#fff"/>
        <!-- Blushing Cheeks -->
        <circle cx="29" cy="54" r="5" fill="#ff708d" opacity="0.6"/>
        <circle cx="71" cy="54" r="5" fill="#ff708d" opacity="0.6"/>
        <!-- Heart Pillow -->
        <path d="M 50 78 C 50 78, 42 70, 36 74 C 30 78, 34 88, 50 96 C 66 88, 70 78, 64 74 C 58 70, 50 78, 50 78 Z" fill="#ff2d55"/>
      `;
    } else if (av === 'kitty') {
      svg.innerHTML = `
        <!-- Cute Kitty Avatar -->
        <defs>
          <radialGradient id="catBody" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#ffffff"/>
            <stop offset="100%" stop-color="#ffeef4"/>
          </radialGradient>
        </defs>
        <!-- Cat Ears -->
        <polygon points="20,40 32,12 44,30" fill="#fff" stroke="#ffb3c6" stroke-width="2"/>
        <polygon points="24,36 32,18 40,29" fill="#ff7597"/>
        <polygon points="80,40 68,12 56,30" fill="#fff" stroke="#ffb3c6" stroke-width="2"/>
        <polygon points="76,36 68,18 60,29" fill="#ff7597"/>
        <!-- Head -->
        <circle cx="50" cy="52" r="36" fill="url(#catBody)" stroke="#ffd1dc" stroke-width="2"/>
        <!-- Smiling Eyes -->
        <path d="M 33 48 Q 40 43 45 49" stroke="#4a1525" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <path d="M 55 49 Q 60 43 67 48" stroke="#4a1525" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <!-- Blushing Cheeks -->
        <circle cx="28" cy="55" r="6" fill="#ff8aa3" opacity="0.65"/>
        <circle cx="72" cy="55" r="6" fill="#ff8aa3" opacity="0.65"/>
        <!-- Nose & Mouth -->
        <polygon points="48,55 52,55 50,58" fill="#ff4d6d"/>
        <path d="M 46 60 Q 50 63 54 60" stroke="#4a1525" stroke-width="2" fill="none" stroke-linecap="round"/>
        <!-- Tiny Rose -->
        <text x="50" y="88" font-size="20" text-anchor="middle">🌹</text>
      `;
    } else if (av === 'bunny') {
      svg.innerHTML = `
        <!-- Sweet Bunny Avatar -->
        <defs>
          <radialGradient id="bunnyBody" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#ffffff"/>
            <stop offset="100%" stop-color="#fff0f5"/>
          </radialGradient>
        </defs>
        <!-- Bunny Ears -->
        <ellipse cx="34" cy="22" rx="9" ry="22" fill="#fff" stroke="#ffb3c6" stroke-width="2"/>
        <ellipse cx="34" cy="22" rx="5" ry="16" fill="#ff8fa3"/>
        <ellipse cx="66" cy="22" rx="9" ry="22" fill="#fff" stroke="#ffb3c6" stroke-width="2"/>
        <ellipse cx="66" cy="22" rx="5" ry="16" fill="#ff8fa3"/>
        <!-- Head -->
        <circle cx="50" cy="56" r="34" fill="url(#bunnyBody)" stroke="#ffd1dc" stroke-width="2"/>
        <!-- Eyes -->
        <ellipse cx="38" cy="54" rx="4" ry="5.5" fill="#38101a"/>
        <circle cx="39.5" cy="52" r="1.8" fill="#fff"/>
        <ellipse cx="62" cy="54" rx="4" ry="5.5" fill="#38101a"/>
        <circle cx="63.5" cy="52" r="1.8" fill="#fff"/>
        <!-- Blush -->
        <ellipse cx="28" cy="61" rx="5.5" ry="4" fill="#ff7597" opacity="0.7"/>
        <ellipse cx="72" cy="61" rx="5.5" ry="4" fill="#ff7597" opacity="0.7"/>
        <!-- Nose & Smile -->
        <polygon points="48,60 52,60 50,63" fill="#ff4d6d"/>
        <path d="M 46 64 Q 50 68 54 64" stroke="#4a1525" stroke-width="2" fill="none" stroke-linecap="round"/>
        <!-- Bow Tie -->
        <path d="M 42 86 L 58 92 L 58 86 L 42 92 Z" fill="#ff4d6d"/>
        <circle cx="50" cy="89" r="3.5" fill="#ff8aa3"/>
      `;
    } else if (av === 'heart') {
      svg.innerHTML = `
        <!-- Sparkle Heart Avatar -->
        <defs>
          <radialGradient id="heartGrad" cx="35%" cy="30%" r="65%">
            <stop offset="0%" stop-color="#ff7597"/>
            <stop offset="100%" stop-color="#e60049"/>
          </radialGradient>
        </defs>
        <!-- Angel Wings -->
        <path d="M 20 45 C 5 35, 0 60, 16 68 C 22 72, 28 65, 28 60 Z" fill="#ffffff" opacity="0.85"/>
        <path d="M 80 45 C 95 35, 100 60, 84 68 C 78 72, 72 65, 72 60 Z" fill="#ffffff" opacity="0.85"/>
        <!-- Heart Body -->
        <path d="M 50 25 C 40 10, 15 15, 18 42 C 20 62, 50 82, 50 82 C 50 82, 80 62, 82 42 C 85 15, 60 10, 50 25 Z" fill="url(#heartGrad)"/>
        <!-- Cute Eyes -->
        <ellipse cx="38" cy="44" rx="4" ry="5.5" fill="#2d0510"/>
        <circle cx="39.5" cy="42" r="1.8" fill="#fff"/>
        <ellipse cx="62" cy="44" rx="4" ry="5.5" fill="#2d0510"/>
        <circle cx="63.5" cy="42" r="1.8" fill="#fff"/>
        <!-- Blush -->
        <circle cx="31" cy="50" r="4.5" fill="#ffb3c6" opacity="0.9"/>
        <circle cx="69" cy="50" r="4.5" fill="#ffb3c6" opacity="0.9"/>
        <!-- Smile -->
        <path d="M 46 51 Q 50 56 54 51" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <!-- Star Sparkle -->
        <polygon points="76,24 78,28 82,30 78,32 76,36 74,32 70,30 74,28" fill="#ffd700"/>
      `;
    } else if (av === 'chick') {
      svg.innerHTML = `
        <!-- Pip the Chick Avatar -->
        <defs>
          <radialGradient id="chickBody" cx="45%" cy="40%" r="55%">
            <stop offset="0%" stop-color="#fff575"/>
            <stop offset="100%" stop-color="#fdbb2d"/>
          </radialGradient>
        </defs>
        <!-- Body -->
        <circle cx="50" cy="52" r="36" fill="url(#chickBody)"/>
        <!-- Flower on head -->
        <circle cx="45" cy="18" r="4" fill="#ff4d6d"/>
        <circle cx="55" cy="18" r="4" fill="#ff4d6d"/>
        <circle cx="50" cy="14" r="4" fill="#ff4d6d"/>
        <circle cx="50" cy="22" r="4" fill="#ff4d6d"/>
        <circle cx="50" cy="18" r="3.5" fill="#ffd700"/>
        <!-- Eyes -->
        <circle cx="38" cy="48" r="4.5" fill="#3a2505"/>
        <circle cx="39.5" cy="46.5" r="1.5" fill="#fff"/>
        <circle cx="62" cy="48" r="4.5" fill="#3a2505"/>
        <circle cx="63.5" cy="46.5" r="1.5" fill="#fff"/>
        <!-- Beak -->
        <polygon points="45,54 55,54 50,62" fill="#ff6b35"/>
        <!-- Blush -->
        <circle cx="28" cy="56" r="6" fill="#ff7597" opacity="0.6"/>
        <circle cx="72" cy="56" r="6" fill="#ff7597" opacity="0.6"/>
        <!-- Wings -->
        <ellipse cx="16" cy="56" rx="5" ry="12" fill="#fdbb2d"/>
        <ellipse cx="84" cy="56" rx="5" ry="12" fill="#fdbb2d"/>
      `;
    } else if (av === 'bot') {
      svg.innerHTML = `
        <!-- Lil Love Bot Avatar -->
        <defs>
          <linearGradient id="botGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#ffb3c6"/>
            <stop offset="100%" stop-color="#ff7597"/>
          </linearGradient>
        </defs>
        <!-- Antenna -->
        <line x1="50" y1="24" x2="50" y2="14" stroke="#ff4d6d" stroke-width="3"/>
        <circle cx="50" cy="12" r="5" fill="#ff2d55"/>
        <!-- Head -->
        <rect x="20" y="24" width="60" height="52" rx="14" fill="url(#botGrad)" stroke="#ff4d6d" stroke-width="2"/>
        <!-- Visor -->
        <rect x="28" y="34" width="44" height="24" rx="8" fill="#1b0710"/>
        <!-- Glowing LED Eyes -->
        <circle cx="40" cy="46" r="4.5" fill="#00ffcc"/>
        <circle cx="60" cy="46" r="4.5" fill="#00ffcc"/>
        <!-- Cheeks -->
        <circle cx="26" cy="62" r="4" fill="#ff2d55" opacity="0.7"/>
        <circle cx="74" cy="62" r="4" fill="#ff2d55" opacity="0.7"/>
        <!-- Heart Flower -->
        <text x="50" y="94" font-size="20" text-anchor="middle">🌸</text>
      `;
    } else {
      // Default: Fairy / Angel
      svg.innerHTML = `
        <!-- Rose Fairy Avatar -->
        <defs>
          <radialGradient id="fairySkin" cx="45%" cy="40%" r="55%">
            <stop offset="0%" stop-color="#fff5eb"/>
            <stop offset="100%" stop-color="#ffe4dc"/>
          </radialGradient>
          <radialGradient id="wingGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#ffffff"/>
            <stop offset="100%" stop-color="#ffb3c6"/>
          </radialGradient>
        </defs>
        <!-- Fluttering Fairy Wings -->
        <path d="M 24 45 C 5 25, 0 58, 20 65 C 28 68, 30 55, 30 50 Z" fill="url(#wingGrad)" opacity="0.85"/>
        <path d="M 76 45 C 95 25, 100 58, 80 65 C 72 68, 70 55, 70 50 Z" fill="url(#wingGrad)" opacity="0.85"/>
        <!-- Hair Back -->
        <circle cx="50" cy="50" r="34" fill="#4a1a2c"/>
        <!-- Face -->
        <circle cx="50" cy="52" r="28" fill="url(#fairySkin)"/>
        <!-- Tiara / Crown -->
        <polygon points="40,28 45,34 50,26 55,34 60,28 58,36 42,36" fill="#ffd700"/>
        <circle cx="50" cy="27" r="2" fill="#ff2d55"/>
        <!-- Eyes -->
        <ellipse cx="41" cy="50" rx="3.5" ry="4.5" fill="#3a101d"/>
        <circle cx="42.5" cy="48.5" r="1.5" fill="#fff"/>
        <ellipse cx="59" cy="50" rx="3.5" ry="4.5" fill="#3a101d"/>
        <circle cx="60.5" cy="48.5" r="1.5" fill="#fff"/>
        <!-- Rosy Cheeks -->
        <circle cx="35" cy="56" r="4.5" fill="#ff7597" opacity="0.75"/>
        <circle cx="65" cy="56" r="4.5" fill="#ff7597" opacity="0.75"/>
        <!-- Sweet Smile -->
        <path d="M 47 57 Q 50 61 53 57" stroke="#b03050" stroke-width="2" fill="none" stroke-linecap="round"/>
        <!-- Wand -->
        <line x1="68" y1="52" x2="84" y2="38" stroke="#ffd700" stroke-width="2"/>
        <polygon points="84,38 86,34 90,34 87,37 88,41 85,39 82,41 83,37 80,34 84,34" fill="#ff4d6d"/>
      `;
    }

    host.appendChild(svg);
  }

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

})();
