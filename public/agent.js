/* ===================================================================
   🌸 Cute Floating AI Guide & Companion Widget (For Ifra)
   =================================================================== */

(function () {
  'use strict';

  // Wait for DOM and SITE content to be ready
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
      ambientTips: true,
      sound: true,
      position: 'bottom-right',
      tour: [],
      notes: [],
      qa: []
    }, C.agent || {});

    if (cfg.enabled === false) return;

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

    container.innerHTML = `
      <div class="agent-character-wrap" id="agentCharacter" role="button" tabindex="0" aria-label="Cute AI Guide">
        <div class="agent-halo"></div>
        <div id="agentAvatarHost" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;"></div>
        <div class="agent-status-badge" id="agentBadge" style="display:none">1</div>
      </div>
      <div class="agent-ambient-tip" id="agentAmbientTip" style="display:none"></div>
      <div class="agent-bubble-window" id="agentBubble">
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
            <button class="agent-act-btn full-w" type="button" id="actTour">✨ Take Me on a Tour</button>
            <button class="agent-act-btn" type="button" id="actPlan">🎮 Plan Valorant / Date</button>
            <button class="agent-act-btn" type="button" id="actDiary">📖 Personal Diary</button>
            <button class="agent-act-btn" type="button" id="actWhisper">💌 Love Note</button>
            <button class="agent-act-btn" type="button" id="actSurprise">🎁 Surprises</button>
            <button class="agent-act-btn" type="button" id="actMusic">🎵 Play Song</button>
            <button class="agent-act-btn" type="button" id="actChat">💬 Chat / Q&A</button>
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

    // Render Avatar
    renderAvatar(avatarHost, cfg);

    if (C.planner && C.planner.enabled === false) {
      const pBtn = document.getElementById('actPlan');
      if (pBtn) pBtn.style.display = 'none';
    }

    // Sparkle Particles Loop
    setInterval(() => {
      if (document.hidden) return;
      createSparkle(charWrap);
    }, 2800);

    // State
    let isBubbleOpen = false;
    let tourIndex = -1;
    let activeSpotlight = null;

    // Play Sound Helper
    function playChime() {
      if (!cfg.sound) return;
      if (!window.AudioContext && !window.webkitAudioContext) return;
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === 'suspended') ctx.resume();
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
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

    // Toggle Bubble
    function openBubble() {
      bubbleWin.classList.add('open');
      isBubbleOpen = true;
      badgeEl.style.display = 'none';
      hideAmbientTip();
      playChime();
    }

    function closeBubble() {
      bubbleWin.classList.remove('open');
      isBubbleOpen = false;
      stopTour();
    }

    function toggleBubble() {
      if (isBubbleOpen) closeBubble();
      else openBubble();
    }

    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeBubble();
    });

    // Touch & Mouse Dragging Physics
    let isDragging = false;
    let startX = 0, startY = 0;
    let initialLeft = 0, initialTop = 0;
    let dragDistance = 0;

    charWrap.addEventListener('mousedown', onDragStart);
    charWrap.addEventListener('touchstart', onDragStart, { passive: false });

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
        const newLeft = Math.max(10, Math.min(window.innerWidth - 85, initialLeft + dx));
        const newTop = Math.max(10, Math.min(window.innerHeight - 85, initialTop + dy));
        container.style.left = newLeft + 'px';
        container.style.top = newTop + 'px';
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
        // Save dragged position
        try {
          const rect = container.getBoundingClientRect();
          localStorage.setItem('ifraAgentPos', JSON.stringify({ x: rect.left, y: rect.top }));
        } catch (e) { }
      }
    }

    // Auto welcome bubble on first arrival
    setTimeout(() => {
      const rose = document.getElementById('roseScreen');
      if (!rose || rose.style.display === 'none' || rose.classList.contains('hide')) {
        openBubble();
      } else {
        // Wait until rose screen is tapped
        const onRoseDone = () => {
          setTimeout(openBubble, 1200);
          rose.removeEventListener('click', onRoseDone);
        };
        rose.addEventListener('click', onRoseDone);
      }
    }, 2400);

    // Guided Tour Feature
    const tourList = (cfg.tour && cfg.tour.length) ? cfg.tour : [
      { id: 'intro', target: '.card', title: 'Welcome, Ifra 🌹', text: 'This whole website was created with endless love by Tayyab, just for you! Every word, song, and memory here belongs to your heart.' },
      { id: 'playlist', target: '.song-section', title: 'Our Romantic Playlist 🎶', text: 'Listen to sweet songs together while you browse! You can switch tracks anytime from the playlist dropdown.' },
      { id: 'letter', target: '#letter', title: 'The Unfolding Love Letter 💌', text: 'A letter that opens slowly and gently, just like how love blossoms deeper and more beautiful each passing day.' },
      { id: 'remind', target: '#remindBtn', title: 'Birthday Reminders 🎂', text: 'Tap this button once to turn on birthday reminders! Your phone will get sweet countdown notifications as your big day approaches.' },
      { id: 'gallery', target: '.gallery-section', title: 'Our Memories Gallery 📸', text: 'A glimpse of precious moments. Tap "Open Full Gallery" to see all photos and sweet captions full-screen!' },
      { id: 'envelopes', target: '.letters-section', title: 'Open When Letters 💌', text: 'Whenever you feel happy, sad, or miss him, open the envelope meant for your heart right now.' },
      { id: 'surprises', target: '.surprises-section', title: 'Little Surprises 🎁', text: 'Scratch cards with love coupons, your flower bouquet, funny riddles, and sweet quizzes! Every single tile hides a treat.' },
      { id: 'games', target: '.tile-grid.three', title: 'Play Together 🎮', text: 'Mini-games made for you two! Catch hearts, race the GT-R R34, and beat each other\'s scores!' },
      { id: 'proposal', target: '.proposal-section', title: 'One Last Thing... 💍', text: 'There is a question that comes straight from his heart. When you are ready, tap inside!' }
    ];

    function startTour() {
      tourIndex = 0;
      actionsGrid.style.display = 'none';
      showTourStep(tourIndex);
    }

    function showTourStep(idx) {
      if (idx < 0 || idx >= tourList.length) {
        stopTour();
        return;
      }
      tourIndex = idx;
      const step = tourList[idx];

      // Clean old spotlight
      if (activeSpotlight) {
        activeSpotlight.classList.remove('agent-tour-spotlight');
        activeSpotlight = null;
      }

      // Find target element
      const targetEl = document.querySelector(step.target);
      if (targetEl) {
        targetEl.classList.add('agent-tour-spotlight');
        activeSpotlight = targetEl;
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      speechEl.innerHTML = `<b>${escapeHtml(step.title)}</b><br><br>${escapeHtml(step.text)}`;

      dynamicEl.innerHTML = `
        <div class="agent-tour-bar">
          <span class="agent-tour-step">Step ${idx + 1} of ${tourList.length}</span>
          <div class="agent-tour-ctrls">
            ${idx > 0 ? '<button class="agent-tour-btn" id="tourPrev">⬅️ Back</button>' : ''}
            <button class="agent-tour-btn next" id="tourNext">${idx < tourList.length - 1 ? 'Next ➡️' : 'Finish ✨'}</button>
            <button class="agent-tour-btn" id="tourExit">✕ Exit</button>
          </div>
        </div>
      `;

      playChime();

      document.getElementById('tourNext').onclick = () => {
        if (tourIndex < tourList.length - 1) showTourStep(tourIndex + 1);
        else stopTour();
      };
      if (document.getElementById('tourPrev')) {
        document.getElementById('tourPrev').onclick = () => showTourStep(tourIndex - 1);
      }
      document.getElementById('tourExit').onclick = stopTour;
    }

    function stopTour() {
      if (activeSpotlight) {
        activeSpotlight.classList.remove('agent-tour-spotlight');
        activeSpotlight = null;
      }
      tourIndex = -1;
      dynamicEl.innerHTML = '';
      actionsGrid.style.display = 'grid';
      speechEl.innerHTML = escapeHtml(cfg.welcomeMsg);
    }

    document.getElementById('actTour').onclick = startTour;

    // Love Notes Feature
    const notesList = (cfg.notes && cfg.notes.length) ? cfg.notes : [
      "Ifra, your smile makes even the dullest days feel like pure magic ✨",
      "You are Tayyab's favourite thought, morning and night 🌙",
      "Did you know? In a room full of art, he would still only look at you 🎨❤️",
      "Your laugh is Tayyab's absolute favourite sound in the whole universe 🎶",
      "No distance can ever weaken a bond written by Allah 🤲💖",
      "You are not just his choice, you are his answered prayer 🌹",
      "Every love song he listens to reminds him of you 🎵"
    ];

    document.getElementById('actPlan').onclick = () => {
      closeBubble();
      if (typeof window.openFun === 'function') window.openFun('calendar');
    };

    const dBtn = document.getElementById('actDiary');
    if (dBtn) {
      dBtn.onclick = () => {
        closeBubble();
        if (typeof window.openFun === 'function') window.openFun('diary');
      };
    }

    document.getElementById('actWhisper').onclick = () => {
      const note = notesList[Math.floor(Math.random() * notesList.length)];
      speechEl.innerHTML = `💌 <b>A whisper from Tayyab:</b><br><br>“${escapeHtml(note)}”`;
      burstHearts(charWrap);
      playChime();
    };

    // Surprises Guide
    document.getElementById('actSurprise').onclick = () => {
      const s = document.querySelector('.surprises-section');
      if (s) s.scrollIntoView({ behavior: 'smooth', block: 'center' });
      speechEl.innerHTML = `🎁 <b>Little Surprises:</b><br><br>Every tile hides a wonder made just for you! You can scratch cards, build your bouquet, or test the love meter ✨ Tap any tile to open!`;
      playChime();
    };

    // Music Player Control
    document.getElementById('actMusic').onclick = () => {
      const music = document.getElementById('bgMusic');
      const toggle = document.getElementById('musicToggle');
      if (toggle) toggle.click();
      else if (music) {
        if (music.paused) music.play();
        else music.pause();
      }
      speechEl.innerHTML = `🎶 <b>Playing romantic melody!</b><br><br>Close your eyes and listen to the song... You can change songs in Our Playlist anytime! 💕`;
      playChime();
    };

    // Chat / Q&A Feature
    const qaList = (cfg.qa && cfg.qa.length) ? cfg.qa : [
      { q: "Who made this website?", a: "Tayyab made this website with all his heart, pouring hours of love and care just to make you smile! ❤️" },
      { q: "How much does Tayyab love me?", a: "To infinity and beyond, more than words, stars, or numbers could ever count! 💖" },
      { q: "What should I explore first?", a: "Start with our playlist 🎶, read the unfolding letter 💌, and then scratch some surprise cards 🎁!" },
      { q: "What if I miss him?", a: "Open the 'Open When You Miss Me' envelope 💌 or send him a message through the 'Write Back To Me' surprise tile!" },
      { q: "Tell me a secret 🤫", a: "Shh... Tap the red heart near the letter multiple times to reveal secret messages! 💖" }
    ];

    document.getElementById('actChat').onclick = () => {
      actionsGrid.style.display = 'none';
      speechEl.innerHTML = `💬 <b>Chat with ${escapeHtml(cfg.name)}:</b><br>Ask me anything or choose a question below:`;

      const chipsHtml = qaList.map((item, i) => `<span class="agent-chip" data-idx="${i}">${escapeHtml(item.q)}</span>`).join('');

      dynamicEl.innerHTML = `
        <div class="agent-chat-wrap">
          <div class="agent-chat-chips">${chipsHtml}</div>
          <div class="agent-chat-input-bar">
            <input type="text" class="agent-chat-input" id="agentChatInp" placeholder="Ask a question..." />
            <button class="agent-chat-send" id="agentChatBtn" type="button">➤</button>
          </div>
          <button class="agent-tour-btn" id="agentChatBack" style="align-self:flex-start;margin-top:4px;">⬅️ Back to Menu</button>
        </div>
      `;

      dynamicEl.querySelectorAll('.agent-chip').forEach(chip => {
        chip.onclick = () => {
          const idx = Number(chip.dataset.idx);
          const item = qaList[idx];
          if (item) {
            speechEl.innerHTML = `<b>You asked:</b> “${escapeHtml(item.q)}”<br><br>✨ ${escapeHtml(item.a)}`;
            playChime();
          }
        };
      });

      const inp = document.getElementById('agentChatInp');
      const send = document.getElementById('agentChatBtn');

      const doSend = () => {
        const val = (inp.value || '').trim();
        if (!val) return;
        inp.value = '';

        // Match against QA
        const found = qaList.find(x => x.q.toLowerCase().includes(val.toLowerCase()) || val.toLowerCase().includes(x.q.toLowerCase()));
        let answer = '';
        if (found) {
          answer = found.a;
        } else if (/love|pyaar|mohabbat/i.test(val)) {
          answer = "Tayyab's love for you is pure, eternal, and growing every single second! 💖";
        } else if (/miss|yaad/i.test(val)) {
          answer = "He misses you more than words can say. Open an envelope in 'Open When' or leave him a note in Write Back! 💌";
        } else if (/who are you|naam|name/i.test(val)) {
          answer = `I am ${cfg.name}, your little AI companion created by Tayyab to bring a warm smile to your face! 🌹`;
        } else {
          answer = `Everything on this website was crafted just for you, Ifra. If there's ever anything in your heart, Tayyab is always right by your side! ❤️`;
        }

        speechEl.innerHTML = `<b>You:</b> “${escapeHtml(val)}”<br><br>✨ ${escapeHtml(answer)}`;
        playChime();
      };

      send.onclick = doSend;
      inp.onkeydown = (e) => { if (e.key === 'Enter') doSend(); };

      document.getElementById('agentChatBack').onclick = () => {
        dynamicEl.innerHTML = '';
        actionsGrid.style.display = 'grid';
        speechEl.innerHTML = escapeHtml(cfg.welcomeMsg);
      };
    };

    // Ambient Scroll Tips
    if (cfg.ambientTips && 'IntersectionObserver' in window) {
      const shownTips = new Set();
      const tips = [
        { sel: '.gallery-section', text: '📸 Tap any photo to see it full-screen with sweet memories!' },
        { sel: '.letters-section', text: '💌 Open an envelope whenever your heart needs a little extra warmth!' },
        { sel: '.surprises-section', text: '🎁 Every tile hides a surprise! Try Scratch Cards or Make a Wish ✨' },
        { sel: '.tile-grid.three', text: '🎮 Mini games to play together! Catch Hearts is super fun!' },
        { sel: '.proposal-section', text: '💍 One special question waiting straight from his heart...' }
      ];

      const obs = new IntersectionObserver((entries) => {
        if (isBubbleOpen) return;
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const tip = tips.find(t => entry.target.matches(t.sel));
            if (tip && !shownTips.has(tip.sel)) {
              shownTips.add(tip.sel);
              showAmbientTip(tip.text);
            }
          }
        });
      }, { threshold: 0.35 });

      tips.forEach(t => {
        const el = document.querySelector(t.sel);
        if (el) obs.observe(el);
      });
    }

    function showAmbientTip(text) {
      if (isBubbleOpen) return;
      ambientTipEl.innerHTML = `<span>✨ ${escapeHtml(text)}</span>`;
      ambientTipEl.style.display = 'block';
      badgeEl.style.display = 'flex';
      setTimeout(hideAmbientTip, 6500);
    }

    function hideAmbientTip() {
      ambientTipEl.style.display = 'none';
    }

    ambientTipEl.onclick = () => {
      hideAmbientTip();
      openBubble();
    };
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
