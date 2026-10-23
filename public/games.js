/* 🎮 Big games (GT-R, Love Flight, Love Breaker): loaded only when she taps their tile, so the first open stays light. */
/* ---------- 🏎️ GAME 4: NISSAN GT-R R34 — NEON CITY HIGHWAY (pseudo-3D, behind-the-car view) ---------- */
FUN.gtr = body => {
  const W = 300, H = 280;
  const GTR_M = gameOpt('gtr', 'distance', 1000, 200, 10000), GTR_H = gameOpt('gtr', 'hearts', 15, 3, 100);
  body.innerHTML = `<h3>Skyline GT-R R34 🏎️</h3>
    <p class="fun-sub" id="gtrInfo">Cruise the neon city highway in the legendary R34! Catch 💖 & hit 🚀 NITRO! (Goal: ${GTR_M}m or ${GTR_H} 💖)</p>
    <div style="position:relative; width:${W}px; max-width:100%; margin:0 auto;">
      <canvas id="gtrCv" class="game-cv" width="${W}" height="${H}" style="cursor:pointer;touch-action:none;width:100%;height:auto;display:block;"></canvas>
    </div>
    <div class="game-controls-row">
      <button class="game-ctrl-btn" id="gtrLeft">◀ Left</button>
      <button class="game-ctrl-btn nitro-btn" id="gtrNitro">🚀 NITRO</button>
      <button class="game-ctrl-btn" id="gtrRight">Right ▶</button>
    </div>
    <div class="fun-btn" id="gtrStart">Start Engine 🏎️</div>`;

  const cv = byId('gtrCv');
  const dpr = (typeof LITE !== 'undefined' && LITE) ? 1 : Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  const ctx = cv.getContext('2d');
  ctx.scale(dpr, dpr);

  /* camera / road constants */
  const HZ = 104, RW = 120, A = 150, CX = W / 2, CARY = H - 18, CURVE_K = 70;
  const TCAR = (CARY - HZ) / (H - HZ), ZCAR = A / (CARY - HZ);
  const LANES = [-0.667, 0, 0.667];
  const NEON = ['#ff2d95', '#22d3ee', '#a78bfa', '#facc15'];

  let raf = 0, last = 0, running = false, alive = true, lowQ = !!(typeof LITE !== 'undefined' && LITE);
  let fT = 0, fN = 0;
  let playerX = 0, dragX = null, steerDir = 0, tilt = 0;
  let distance = 0, hearts = 0, nitro = 100, isNitro = false, invuln = 0, shake = 0;
  let speed = 0, posZ = 0, curve = 0, skyOff = 0;
  let traffic = [], pickups = [], sparks = [], pops = [];
  let tTimer = 1, pTimer = 1.2;

  /* ---------- pre-rendered backdrops (drawn once, then just blitted) ---------- */
  function mk(w, h) { const c = document.createElement('canvas'); c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); const g = c.getContext('2d'); g.scale(dpr, dpr); return [c, g]; }
  function rngf(seed) { let r = seed; return () => { r = (r * 16807) % 2147483647; return r / 2147483647; }; }
  const [skyC, sg] = mk(W, HZ + 2);
  (function () {
    const gr = sg.createLinearGradient(0, 0, 0, HZ);
    gr.addColorStop(0, '#05001a'); gr.addColorStop(0.45, '#1d0646'); gr.addColorStop(0.8, '#7a1b6e'); gr.addColorStop(1, '#ff4d8d');
    sg.fillStyle = gr; sg.fillRect(0, 0, W, HZ + 2);
    const rnd = rngf(77);
    for (let i = 0; i < 30; i++) { sg.fillStyle = 'rgba(255,255,255,' + (0.25 + rnd() * 0.6) + ')'; sg.fillRect((rnd() * W) | 0, (rnd() * 58) | 0, 1, 1); }
    const [sc, g2] = mk(80, 80);
    const sgr = g2.createLinearGradient(0, 10, 0, 70); sgr.addColorStop(0, '#fff2a8'); sgr.addColorStop(1, '#ff4f9a');
    g2.fillStyle = sgr; g2.beginPath(); g2.arc(40, 40, 30, 0, 7); g2.fill();
    g2.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 6; i++) g2.fillRect(0, 42 + i * 6.5, 80, 1 + i * 0.8);
    sg.drawImage(sc, CX - 40, HZ - 58, 80, 80);
  })();
  function mkCity(minH, maxH, top, bot, seed, neon) {
    const [c, g] = mk(W, HZ + 2), rnd = rngf(seed);
    let x = 0;
    while (x < W) {
      let bw = 14 + rnd() * 24; if (W - x - bw < 12) bw = W - x;
      const bh = minH + rnd() * (maxH - minH);
      const gr = g.createLinearGradient(0, HZ - bh, 0, HZ); gr.addColorStop(0, top); gr.addColorStop(1, bot);
      g.fillStyle = gr; g.fillRect(x, HZ - bh, bw, bh + 2);
      const n = Math.floor(bw * bh / 70);
      for (let k = 0; k < n; k++) { g.fillStyle = rnd() < 0.5 ? 'rgba(255,200,120,.65)' : 'rgba(120,220,255,.6)'; g.fillRect((x + 2 + rnd() * (bw - 5)) | 0, (HZ - bh + 3 + rnd() * (bh - 8)) | 0, 1.5, 1.5); }
      if (neon && rnd() < 0.5) { g.fillStyle = rnd() < 0.5 ? '#ff2d95' : '#22d3ee'; g.fillRect(x, HZ - bh, bw, 1.2); }
      x += bw;
    }
    return c;
  }
  const cityFar = mkCity(18, 46, '#3a1470', '#1b0640', 11, false);
  const cityNear = mkCity(26, 74, '#1d0640', '#0d0220', 29, true);

  /* ---------- little helpers ---------- */
  function glow(c, x, y, r, col, a) {
    if (lowQ) { c.fillStyle = col; c.globalAlpha = a * 0.7; c.fillRect(x - r * 0.35, y - r * 0.35, r * 0.7, r * 0.7); c.globalAlpha = 1; return; }
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.globalAlpha = a; c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); c.globalAlpha = 1;
  }
  function rr(c, x, y, w, h, r) { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); }
  function proj(z, lane) {
    const t = A / (z * (H - HZ));
    return { t, y: HZ + A / z, x: CX + curve * (1 - t) * (1 - t) * CURVE_K + lane * RW * t };
  }
  function hash(i) { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }

  /* ---------- sprites ---------- */
  function drawTraffic(c, x, y, t, col) {
    const w = 54 * t, h = 36 * t;
    c.fillStyle = 'rgba(0,0,0,.45)'; c.beginPath(); c.ellipse(x, y, w * 0.58, h * 0.14, 0, 0, 7); c.fill();
    c.fillStyle = '#07040f'; c.fillRect(x - w * 0.46, y - h * 0.3, w * 0.16, h * 0.3); c.fillRect(x + w * 0.3, y - h * 0.3, w * 0.16, h * 0.3);
    c.fillStyle = col; rr(c, x - w / 2, y - h * 0.68, w, h * 0.5, 3 * t); c.fill();
    c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(x - w * 0.46, y - h * 0.6, w * 0.92, Math.max(1, h * 0.04));
    c.fillStyle = '#0d1026'; c.beginPath(); c.moveTo(x - w * 0.36, y - h * 0.66); c.lineTo(x - w * 0.26, y - h); c.lineTo(x + w * 0.26, y - h); c.lineTo(x + w * 0.36, y - h * 0.66); c.fill();
    c.fillStyle = '#ff2338'; c.fillRect(x - w * 0.44, y - h * 0.55, w * 0.2, h * 0.12); c.fillRect(x + w * 0.24, y - h * 0.55, w * 0.2, h * 0.12);
    c.globalCompositeOperation = 'lighter';
    glow(c, x - w * 0.34, y - h * 0.49, w * 0.4, '#ff2338', 0.6); glow(c, x + w * 0.34, y - h * 0.49, w * 0.4, '#ff2338', 0.6);
    c.globalCompositeOperation = 'source-over';
  }
  function heart(c, x, y, s, col) {
    c.fillStyle = col; c.beginPath();
    c.moveTo(x, y + s * 0.9);
    c.bezierCurveTo(x - s * 1.6, y - s * 0.1, x - s * 0.9, y - s * 1.2, x, y - s * 0.45);
    c.bezierCurveTo(x + s * 0.9, y - s * 1.2, x + s * 1.6, y - s * 0.1, x, y + s * 0.9);
    c.fill();
  }
  function drawPickup(c, p, x, y, t) {
    const bob = Math.sin(posZ * 0.12 + p.ph) * 3 * t, yy = y - 22 * t + bob;
    c.globalCompositeOperation = 'lighter';
    glow(c, x, yy, 24 * t, p.kind === 'h' ? '#ff4d8d' : '#22d3ee', 0.8);
    c.globalCompositeOperation = 'source-over';
    if (p.kind === 'h') heart(c, x, yy, 9 * t, '#ff6fa5');
    else { c.fillStyle = '#7dd3fc'; c.beginPath(); c.moveTo(x + 2 * t, yy - 11 * t); c.lineTo(x - 7 * t, yy + 2 * t); c.lineTo(x - 1 * t, yy + 2 * t); c.lineTo(x - 3 * t, yy + 11 * t); c.lineTo(x + 7 * t, yy - 3 * t); c.lineTo(x + 1 * t, yy - 3 * t); c.closePath(); c.fill(); }
    c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(x, y, 9 * t, 2.5 * t, 0, 0, 7); c.fill();
  }
  function drawPost(c, x, y, t, col, i) {
    c.fillStyle = '#1a0b30'; c.fillRect(x - 1.3 * t, y - 74 * t, 2.6 * t, 74 * t);
    c.fillStyle = col; c.fillRect(x - 5 * t, y - 76 * t, 10 * t, 2.4 * t);
    c.globalCompositeOperation = 'lighter';
    glow(c, x, y - 74 * t, 26 * t, col, 0.7);
    c.globalCompositeOperation = 'source-over';
    if (i % 4 === 0) {          // neon sign
      const sx = x + (x < CX ? -18 : 18) * t;
      c.fillStyle = '#0d0220'; c.fillRect(sx - 12 * t, y - 98 * t, 24 * t, 15 * t);
      c.strokeStyle = col; c.lineWidth = Math.max(1, 1.4 * t); c.strokeRect(sx - 12 * t, y - 98 * t, 24 * t, 15 * t);
      if (t > 0.18) heart(c, sx, y - 91 * t, 4 * t, col);
    }
  }
  function drawBuilding(c, x, y, t, side, i) {
    const h1 = hash(i), w = (36 + h1 * 36) * t, h = (70 + hash(i + 5) * 120) * t;
    const bx = side < 0 ? x - w : x;
    c.fillStyle = '#12042b'; c.fillRect(bx, y - h, w, h);
    c.fillStyle = h1 < 0.5 ? '#ff2d95' : '#22d3ee';
    c.fillRect(side < 0 ? bx + w - Math.max(1, 1.6 * t) : bx, y - h, Math.max(1, 1.6 * t), h);
    c.fillRect(bx, y - h, w, Math.max(1, 1.2 * t));
    if (!lowQ && t > 0.2) {
      c.fillStyle = 'rgba(255,205,130,.7)';
      const cols = 3, rows = Math.min(7, Math.floor(h / (14 * t)));
      for (let a = 0; a < cols; a++) for (let b = 0; b < rows; b++) if (hash(i * 7 + a * 3 + b) > 0.45) c.fillRect(bx + (5 + a * 11) * t, y - h + (7 + b * 14) * t, 5 * t, 6 * t);
    }
  }

  /* optional: drop a transparent PNG of a real GT-R's rear called gtr-rear.png next to index.html and it is used instead of the drawn car */
  let carImg = null;
  (function () { const im = new Image(); im.onload = () => { if (im.naturalWidth > 20) carImg = im; }; im.onerror = () => { }; im.src = 'gtr-rear.png'; })();

  function drawGTR(c, x, y, tl, nitroOn, flash) {
    if (flash > 0 && Math.floor(flash * 14) % 2 === 0) return;
    c.save(); c.translate(x, y); c.rotate(tl);
    /* neon underglow + contact shadow */
    c.save(); c.scale(1, 0.24); c.globalCompositeOperation = 'lighter'; glow(c, 0, 5, 66, nitroOn ? '#38bdf8' : '#ec4899', 0.7); c.restore();
    c.fillStyle = 'rgba(0,0,0,.6)'; c.beginPath(); c.ellipse(0, 1, 44, 5.5, 0, 0, 7); c.fill();
    const flames = () => {
      if (!nitroOn) return;
      for (const sx of [-11, 11]) {
        const L = 22 + Math.random() * 18, fg = c.createLinearGradient(0, -6, 0, L);
        fg.addColorStop(0, '#ffffff'); fg.addColorStop(0.3, '#7dd3fc'); fg.addColorStop(1, 'rgba(59,130,246,0)');
        c.fillStyle = fg; c.beginPath(); c.moveTo(sx - 3.5, -5); c.lineTo(sx, L); c.lineTo(sx + 3.5, -5); c.fill();
      }
    };
    if (carImg) {   /* real photo sprite */
      const w = 92, h = w * carImg.naturalHeight / carImg.naturalWidth;
      c.drawImage(carImg, -w / 2, 3 - h, w, h);
      flames(); c.restore(); return;
    }
    let g;
    /* tyres: wide, with sidewall shading */
    for (const sx of [-1, 1]) {
      g = c.createLinearGradient(sx * 34, 0, sx * 47, 0); g.addColorStop(0, '#0a0a10'); g.addColorStop(0.5, '#23252e'); g.addColorStop(1, '#07070b');
      c.fillStyle = g; rr(c, sx < 0 ? -47 : 34, -19, 13, 19, 3); c.fill();
      c.fillStyle = 'rgba(255,255,255,.10)'; c.fillRect(sx < 0 ? -45 : 36, -17, 1.2, 14);
    }
    /* lower valance + diffuser */
    g = c.createLinearGradient(0, -24, 0, -4); g.addColorStop(0, '#1b2f78'); g.addColorStop(0.45, '#0f1b4a'); g.addColorStop(1, '#07091a');
    c.fillStyle = g; c.beginPath(); c.moveTo(-42, -24); c.lineTo(42, -24); c.lineTo(39, -6); c.quadraticCurveTo(0, -1, -39, -6); c.closePath(); c.fill();
    c.fillStyle = '#06070d'; c.beginPath(); c.moveTo(-26, -14); c.lineTo(26, -14); c.lineTo(23, -4); c.lineTo(-23, -4); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(120,140,200,.35)'; c.lineWidth = 0.8;
    for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * 8, -13.5); c.lineTo(i * 7.2, -4.5); c.stroke(); }
    /* twin round exhausts */
    for (const sx of [-12, 12]) {
      g = c.createRadialGradient(sx - 1, -9.5, 0.5, sx, -9, 5); g.addColorStop(0, '#e5e7eb'); g.addColorStop(0.6, '#8b93a1'); g.addColorStop(1, '#4b5563');
      c.fillStyle = g; c.beginPath(); c.arc(sx, -9, 4.6, 0, 7); c.fill();
      c.fillStyle = '#030306'; c.beginPath(); c.arc(sx, -9, 3.1, 0, 7); c.fill();
      c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.arc(sx - 1.5, -10.5, 0.9, 0, 7); c.fill();
    }
    flames();
    /* trunk face: flared fenders, metallic bayside blue */
    c.save();
    c.beginPath(); c.moveTo(-42, -22); c.quadraticCurveTo(-45, -36, -41, -47); c.lineTo(41, -47); c.quadraticCurveTo(45, -36, 42, -22); c.closePath();
    g = c.createLinearGradient(0, -47, 0, -22); g.addColorStop(0, '#6aa0ff'); g.addColorStop(0.18, '#3a6df0'); g.addColorStop(0.6, '#1f45b8'); g.addColorStop(1, '#122a73');
    c.fillStyle = g; c.fill(); c.clip();
    g = c.createLinearGradient(-42, 0, 42, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.25, 'rgba(255,255,255,.20)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(0.8, 'rgba(255,255,255,.08)'); g.addColorStop(1, 'rgba(0,0,0,.25)');
    c.fillStyle = g; c.fillRect(-45, -48, 90, 30);
    c.fillStyle = 'rgba(0,0,0,.28)'; c.fillRect(-45, -26, 90, 5);                       /* shadow where the body tucks under */
    c.strokeStyle = 'rgba(255,255,255,.28)'; c.lineWidth = 1; c.beginPath(); c.moveTo(-40, -45.5); c.lineTo(40, -45.5); c.stroke();   /* trunk lip highlight */
    c.strokeStyle = 'rgba(8,18,60,.55)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(-42, -41); c.lineTo(42, -41); c.stroke();           /* panel gap */
    c.strokeStyle = 'rgba(255,90,170,.35)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-43, -44); c.quadraticCurveTo(-45, -35, -42, -24); c.stroke();  /* neon rim light */
    c.strokeStyle = 'rgba(34,211,238,.35)'; c.beginPath(); c.moveTo(43, -44); c.quadraticCurveTo(45, -35, 42, -24); c.stroke();
    c.restore();
    /* dark centre garnish with chrome lettering strip, plate recess */
    c.fillStyle = '#0a0c16'; rr(c, -11, -40, 22, 13, 2); c.fill();
    c.fillStyle = '#b8bfcc'; for (let i = 0; i < 9; i++) c.fillRect(-9.5 + i * 2.4, -39, 1.4, 1.5);
    c.fillStyle = '#f4f6fa'; rr(c, -9.5, -37, 19, 8.5, 1); c.fill();
    c.fillStyle = '#1e293b'; c.font = 'bold 5px Poppins, sans-serif'; c.textAlign = 'center'; c.fillText('IFRA', 0, -30.7);
    c.fillStyle = '#6b7280'; c.fillRect(-8.5, -36.4, 1, 1); c.fillRect(7.5, -36.4, 1, 1);
    /* four round tail lamps in dark housings */
    for (const sx of [-1, 1]) {
      c.fillStyle = '#2b060d'; rr(c, sx < 0 ? -38 : 12, -42, 26, 14, 6); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 0.7; rr(c, sx < 0 ? -38 : 12, -42, 26, 14, 6); c.stroke();
    }
    const lamps = [[-31, -35, 6], [-18, -35, 5.4], [18, -35, 5.4], [31, -35, 6]];
    lamps.forEach(l => {
      c.fillStyle = '#080204'; c.beginPath(); c.arc(l[0], l[1], l[2] + 1.3, 0, 7); c.fill();
      const rg = c.createRadialGradient(l[0] - 1.5, l[1] - 1.5, 0.4, l[0], l[1], l[2]);
      rg.addColorStop(0, '#ffd0d0'); rg.addColorStop(0.35, '#ff3030'); rg.addColorStop(0.8, '#a60f1b'); rg.addColorStop(1, '#5c0710');
      c.fillStyle = rg; c.beginPath(); c.arc(l[0], l[1], l[2], 0, 7); c.fill();
      c.strokeStyle = 'rgba(40,0,6,.7)'; c.lineWidth = 0.8; c.beginPath(); c.arc(l[0], l[1], l[2] * 0.58, 0, 7); c.stroke();   /* reflector ring */
      c.fillStyle = 'rgba(255,255,255,.75)'; c.beginPath(); c.arc(l[0] - l[2] * 0.35, l[1] - l[2] * 0.4, l[2] * 0.16, 0, 7); c.fill();
    });
    c.globalCompositeOperation = 'lighter';
    lamps.forEach(l => glow(c, l[0], l[1], 20, '#ff2030', nitroOn ? 0.95 : 0.7));
    c.globalCompositeOperation = 'source-over';
    /* cabin: body-coloured C-pillars + dark sloped rear glass */
    g = c.createLinearGradient(0, -68, 0, -46); g.addColorStop(0, '#5b92fb'); g.addColorStop(1, '#2350c4');
    c.fillStyle = g; c.beginPath(); c.moveTo(-36, -46); c.lineTo(-27, -66); c.quadraticCurveTo(0, -69, 27, -66); c.lineTo(36, -46); c.closePath(); c.fill();
    g = c.createLinearGradient(0, -64, 0, -47); g.addColorStop(0, '#26315f'); g.addColorStop(0.6, '#0b1130'); g.addColorStop(1, '#04060f');
    c.fillStyle = g; c.beginPath(); c.moveTo(-31, -47); c.lineTo(-23, -63); c.lineTo(23, -63); c.lineTo(31, -47); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,90,170,.20)'; c.beginPath(); c.moveTo(-26, -48); c.lineTo(-12, -48); c.lineTo(-5, -62); c.lineTo(-19, -62); c.closePath(); c.fill();
    c.fillStyle = 'rgba(34,211,238,.17)'; c.beginPath(); c.moveTo(8, -48); c.lineTo(15, -48); c.lineTo(19, -62); c.lineTo(12, -62); c.closePath(); c.fill();
    c.fillStyle = 'rgba(0,0,0,.55)'; rr(c, -14, -58, 9, 9, 3); c.fill(); rr(c, 5, -58, 9, 9, 3); c.fill();   /* headrests */
    c.fillStyle = '#080c1c'; c.fillRect(-12, -62.6, 24, 1.6);                                                /* third brake light */
    c.fillStyle = '#ff2a2a'; c.fillRect(-9, -62.2, 18, 0.9);
    c.fillStyle = 'rgba(255,255,255,.30)'; c.beginPath(); c.moveTo(-27, -66); c.quadraticCurveTo(0, -69.5, 27, -66); c.lineTo(27, -65); c.quadraticCurveTo(0, -68.4, -27, -65); c.fill();   /* roof highlight */
    /* mirrors */
    c.fillStyle = '#2a5be0'; rr(c, -43, -58, 7, 5, 2); c.fill(); rr(c, 36, -58, 7, 5, 2); c.fill();
    /* big rear wing on angled uprights */
    c.fillStyle = '#06070c'; c.beginPath(); c.moveTo(-26, -47); c.lineTo(-22, -47); c.lineTo(-21, -73); c.lineTo(-25, -73); c.fill();
    c.beginPath(); c.moveTo(26, -47); c.lineTo(22, -47); c.lineTo(21, -73); c.lineTo(25, -73); c.fill();
    g = c.createLinearGradient(0, -80, 0, -72); g.addColorStop(0, '#3b4257'); g.addColorStop(0.5, '#0e111b'); g.addColorStop(1, '#05060b');
    c.fillStyle = g; rr(c, -42, -80, 84, 8, 2); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.14)'; c.lineWidth = 0.6;
    for (let i = -40; i < 40; i += 4) { c.beginPath(); c.moveTo(i, -79); c.lineTo(i + 3, -73); c.stroke(); }   /* carbon weave */
    c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(-40, -79.6, 80, 1);
    c.fillStyle = '#05060b'; rr(c, -44, -84, 3.5, 16, 1); c.fill(); rr(c, 40.5, -84, 3.5, 16, 1); c.fill();
    c.strokeStyle = 'rgba(255,90,170,.35)'; c.lineWidth = 1; c.beginPath(); c.moveTo(-42, -80.5); c.lineTo(0, -81); c.stroke();
    c.strokeStyle = 'rgba(34,211,238,.35)'; c.beginPath(); c.moveTo(0, -81); c.lineTo(42, -80.5); c.stroke();
    c.restore();
  }

  /* ---------- the scene ---------- */
  function render(dt) {
    const c = ctx;
    c.save();
    if (shake > 0) c.translate((Math.random() - 0.5) * shake * 9, (Math.random() - 0.5) * shake * 9);
    c.drawImage(skyC, 0, 0, W, HZ + 2);
    const o1 = (((skyOff * 0.35) % W) + W) % W, o2 = (((skyOff * 0.8) % W) + W) % W;
    c.drawImage(cityFar, -o1, 0, W, HZ + 2); c.drawImage(cityFar, W - o1, 0, W, HZ + 2);
    c.drawImage(cityNear, -o2, 0, W, HZ + 2); c.drawImage(cityNear, W - o2, 0, W, HZ + 2);

    /* ground + road, one thin strip at a time */
    const step = lowQ ? 3 : 2;
    for (let y = HZ + 1; y < H; y += step) {
      const t = (y - HZ) / (H - HZ), d = A / (y - HZ), far = (y - HZ) < 9;
      const band = far ? 0 : (Math.floor((d + posZ) / 7) & 1);
      const cxr = CX + curve * (1 - t) * (1 - t) * CURVE_K, rw = RW * t;
      c.fillStyle = band ? '#0e0324' : '#14062e'; c.fillRect(0, y, W, step);
      c.fillStyle = band ? '#21103f' : '#2a1550'; c.fillRect(cxr - rw, y, rw * 2, step);
      const ew = Math.max(1, 3.2 * t), rumble = !far && (Math.floor((d + posZ) / 4) & 1);
      c.fillStyle = rumble ? '#ff2d95' : '#22d3ee';
      c.fillRect(cxr - rw - ew, y, ew, step); c.fillRect(cxr + rw, y, ew, step);
      if (!far && ((Math.floor((d + posZ) / 5) & 1) === 0)) {
        const lw = Math.max(1, 2.4 * t);
        c.fillStyle = 'rgba(255,255,255,.75)';
        c.fillRect(cxr - rw / 3 - lw / 2, y, lw, step); c.fillRect(cxr + rw / 3 - lw / 2, y, lw, step);
      }
    }
    /* neon haze at the horizon */
    const hz = c.createLinearGradient(0, HZ - 6, 0, HZ + 44);
    hz.addColorStop(0, 'rgba(255,60,140,.0)'); hz.addColorStop(0.2, 'rgba(255,60,140,.38)'); hz.addColorStop(1, 'rgba(255,60,140,0)');
    c.fillStyle = hz; c.fillRect(0, HZ - 6, W, 50);

    /* headlight cone on the road */
    const carSX = CX + playerX * RW * TCAR, hvx = CX + curve * CURVE_K * 0.04;
    c.globalCompositeOperation = 'lighter';
    const cg = c.createLinearGradient(0, CARY - 36, 0, HZ + 10); cg.addColorStop(0, 'rgba(190,225,255,.22)'); cg.addColorStop(1, 'rgba(190,225,255,0)');
    c.fillStyle = cg; c.beginPath(); c.moveTo(carSX - 12, CARY - 36); c.lineTo(carSX + 12, CARY - 36); c.lineTo(hvx + 16, HZ + 10); c.lineTo(hvx - 16, HZ + 10); c.fill();
    c.globalCompositeOperation = 'source-over';

    /* everything standing on the road, far to near */
    const list = [];
    const i0 = Math.floor(posZ / 7);
    for (let k = 1; k < (lowQ ? 11 : 15); k++) {
      const idx = i0 + k, z = idx * 7 - posZ;
      if (z < 0.7 || z > 100) continue;
      list.push({ z, k: 'p', i: idx, s: -1 }); list.push({ z, k: 'p', i: idx, s: 1 });
      if (idx % 2 === 0) list.push({ z: z + 3, k: 'b', i: idx, s: idx % 4 === 0 ? -1 : 1 });
    }
    traffic.forEach(o => list.push({ z: o.z, k: 't', o }));
    pickups.forEach(p => list.push({ z: p.z, k: 'u', o: p }));
    list.sort((a, b) => b.z - a.z);
    for (let n = 0; n < list.length; n++) {
      const e = list[n];
      if (e.k === 'p') { const q = proj(e.z, e.s * 1.28); if (q.y < H + 40) drawPost(c, q.x, q.y, q.t, NEON[(e.i + (e.s > 0 ? 1 : 0)) & 1], e.i); }
      else if (e.k === 'b') { const q = proj(e.z, e.s * (1.75 + hash(e.i) * 0.9)); if (q.y < H + 60) drawBuilding(c, q.x, q.y, q.t, e.s, e.i); }
      else if (e.k === 't') { const q = proj(e.o.z, e.o.lane); if (q.y < H + 40) drawTraffic(c, q.x, q.y, q.t, e.o.col); }
      else { const q = proj(e.o.z, e.o.lane); drawPickup(c, e.o, q.x, q.y, q.t); }
    }

    /* speed streaks */
    if (speed > 42) {
      c.strokeStyle = 'rgba(190,235,255,' + Math.min(0.45, (speed - 42) / 30) + ')'; c.lineWidth = 1.2;
      for (let k = 0; k < 12; k++) {
        const ang = Math.PI * (0.06 + 0.88 * ((k * 0.618) % 1)), r = ((posZ * 0.07 + k * 0.37) % 1), r0 = 24 + r * 150, r1 = r0 + 10 + r * 44;
        c.beginPath(); c.moveTo(CX + Math.cos(ang) * r0 * 1.3, HZ + 8 + Math.sin(ang) * r0); c.lineTo(CX + Math.cos(ang) * r1 * 1.3, HZ + 8 + Math.sin(ang) * r1); c.stroke();
      }
    }

    /* the GT-R from behind */
    const bob = Math.sin(posZ * 0.9) * (speed > 24 ? 0.5 : 0);
    drawGTR(c, carSX, CARY + bob, tilt, isNitro && nitro > 0, invuln);

    /* sparks + popups */
    c.globalCompositeOperation = 'lighter';
    sparks.forEach(s => { c.fillStyle = s.col; c.globalAlpha = Math.max(0, s.life * 2); c.fillRect(s.x, s.y, 2, 2); });
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    c.font = 'bold 12px Poppins, sans-serif'; c.textAlign = 'center';
    pops.forEach(p => { c.globalAlpha = Math.min(1, p.life * 2); c.fillStyle = p.col; c.fillText(p.txt, p.x, p.y); });
    c.globalAlpha = 1;

    /* nitro vignette */
    if (isNitro && nitro > 0) {
      const vg = c.createRadialGradient(CX, H / 2, 70, CX, H / 2, 200); vg.addColorStop(0, 'rgba(56,189,248,0)'); vg.addColorStop(1, 'rgba(56,189,248,.28)');
      c.fillStyle = vg; c.fillRect(0, 0, W, H);
    }
    c.restore();

    /* HUD */
    c.font = 'bold 13px Poppins, sans-serif'; c.textAlign = 'left'; c.fillStyle = isNitro ? '#7dd3fc' : '#ffffff';
    c.shadowColor = 'rgba(0,0,0,.8)'; c.shadowBlur = 4;
    c.fillText(Math.round(speed * 3.4) + ' KM/H', 10, 18);
    c.textAlign = 'right'; c.fillStyle = '#ff9ec0';
    c.fillText('💖 ' + hearts + '/' + GTR_H + '  |  🏁 ' + Math.min(GTR_M, Math.floor(distance)) + 'm', W - 10, 18);
    c.shadowBlur = 0;
    c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(10, H - 12, W - 20, 7);
    const ng = c.createLinearGradient(10, 0, W - 10, 0); ng.addColorStop(0, '#06b6d4'); ng.addColorStop(1, '#8b5cf6');
    c.fillStyle = ng; c.fillRect(10, H - 12, (W - 20) * (nitro / 100), 7);
    c.strokeStyle = 'rgba(255,255,255,.3)'; c.strokeRect(10, H - 12, W - 20, 7);
    if (!running) {
      c.textAlign = 'center'; c.font = 'bold 15px Poppins, sans-serif'; c.fillStyle = '#fff';
      c.shadowColor = '#ff2d95'; c.shadowBlur = 12; c.fillText('Tap to start 🏎️', CX, HZ + 44); c.shadowBlur = 0;
    }
  }

  /* ---------- game rules ---------- */
  function spawnTraffic() {
    const lane = LANES[(Math.random() * 3) | 0];
    if (traffic.some(o => o.z > 60 && Math.abs(o.lane - lane) < 0.1)) return;
    traffic.push({ z: 88, lane, v: 8 + Math.random() * 7, col: ['#ff2d95', '#22d3ee', '#f59e0b', '#a78bfa', '#34d399'][(Math.random() * 5) | 0] });
  }
  function spawnPickup() { pickups.push({ z: 88, lane: (Math.random() * 1.6 - 0.8), kind: Math.random() < 0.72 ? 'h' : 'n', ph: Math.random() * 6 }); }
  function burst(x, y, col, n) { for (let i = 0; i < n; i++) sparks.push({ x, y, vx: (Math.random() - 0.5) * 140, vy: -Math.random() * 110, life: 0.5 + Math.random() * 0.3, col }); }
  function pop(x, y, txt, col) { pops.push({ x, y, txt, col, life: 0.9 }); }

  function update(dt) {
    const tv = (isNitro && nitro > 0) ? 58 : 30;
    speed += (tv - speed) * Math.min(1, dt * (isNitro ? 2.4 : 1.1));
    if (isNitro) { nitro = Math.max(0, nitro - dt * 26); if (nitro <= 0) isNitro = false; } else nitro = Math.min(100, nitro + dt * 5);
    posZ += speed * 0.9 * dt; distance += speed * 0.8 * dt;
    curve = Math.sin(distance * 0.012) * 0.65 + Math.sin(distance * 0.005 + 1.3) * 0.35;
    skyOff += curve * speed * dt * 0.22;
    let steer = steerDir;
    if (dragX !== null) { steer = Math.max(-1, Math.min(1, (dragX - playerX) * 3)); playerX += (dragX - playerX) * Math.min(1, dt * 9); }
    else playerX += steerDir * dt * 1.7;
    playerX -= curve * dt * 0.45 * (speed / 30);
    if (playerX > 0.95) { playerX = 0.95; speed *= 0.99; } else if (playerX < -0.95) { playerX = -0.95; speed *= 0.99; }
    tilt += (Math.max(-0.12, Math.min(0.12, steer * 0.08 + curve * 0.03)) - tilt) * Math.min(1, dt * 8);
    invuln = Math.max(0, invuln - dt); shake = Math.max(0, shake - dt * 1.6);

    tTimer -= dt; if (tTimer <= 0) { spawnTraffic(); tTimer = (0.85 + Math.random() * 0.9) * Math.sqrt(30 / Math.max(22, speed)); }
    pTimer -= dt; if (pTimer <= 0) { spawnPickup(); pTimer = 1.3 + Math.random() * 1.3; }

    const carSX = CX + playerX * RW * TCAR;
    for (let i = traffic.length - 1; i >= 0; i--) {
      const o = traffic[i]; o.z -= (speed - o.v) * 0.9 * dt;
      if (o.z < 0.3 || o.z > 120) { traffic.splice(i, 1); continue; }
      if (invuln <= 0 && Math.abs(o.z - ZCAR) < 0.42 && Math.abs(o.lane - playerX) < 0.4) {
        speed = 9; invuln = 1.6; shake = 0.5; nitro = Math.max(0, nitro - 14); isNitro = false;
        burst(carSX, CARY - 20, '#ffd27a', 16); pop(carSX, CARY - 70, 'Ouch! 💥', '#ffb4b4');
        if (window.PLUS) PLUS.sfx('bad');
      }
    }
    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i]; p.z -= speed * 0.9 * dt;
      if (p.z < 0.3) { pickups.splice(i, 1); continue; }
      if (Math.abs(p.z - ZCAR) < 0.5 && Math.abs(p.lane - playerX) < 0.32) {
        if (p.kind === 'h') { hearts++; pop(carSX, CARY - 70, '+1 💖', '#ff9ec0'); burst(carSX, CARY - 40, '#ff6fa5', 10); }
        else { nitro = Math.min(100, nitro + 38); pop(carSX, CARY - 70, 'NITRO ⚡', '#7dd3fc'); burst(carSX, CARY - 40, '#7dd3fc', 10); }
        if (window.PLUS) PLUS.sfx('pickup');
        pickups.splice(i, 1);
      }
    }
    sparks.forEach(s => { s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 260 * dt; s.life -= dt; });
    sparks = sparks.filter(s => s.life > 0);
    pops.forEach(p => { p.y -= 28 * dt; p.life -= dt; });
    pops = pops.filter(p => p.life > 0);
  }

  function loop(now) {
    if (!alive || !running) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    fT += dt; fN++;
    if (fN === 90 && !lowQ && fT / fN > 0.026) lowQ = true;   // phone is struggling: switch to the lighter look
    update(dt); render(dt);
    if (distance >= GTR_M || hearts >= GTR_H) {
      running = false;
      const b = byId('gtrStart');
      b.textContent = 'Drive again 🏎️'; b.style.display = '';
      byId('gtrInfo').textContent = `Mission Complete! Distance: ${Math.floor(distance)}m, Hearts: ${hearts} 💕`;
      setTimeout(() => celebrate(
        'You conquered the neon highway in the Nissan GT-R R34, but my heart was already racing for you at 300 km/h 🏎️💨',
        `🏁 ${Math.floor(distance)}m conquered | 💖 ${hearts} hearts collected`
      ), 700);
      return;
    }
    raf = requestAnimationFrame(loop);
  }

  function start() {
    if (running) return;
    running = true; distance = 0; hearts = 0; nitro = 100; isNitro = false; invuln = 0; shake = 0;
    traffic = []; pickups = []; sparks = []; pops = []; playerX = 0; dragX = null; steerDir = 0; speed = 12; posZ = 0; tTimer = 1.2; pTimer = 0.8; fT = 0; fN = 0;
    byId('gtrStart').style.display = 'none';
    byId('gtrInfo').textContent = 'Hold NITRO for 190+ km/h! Dodge traffic & catch hearts 💖';
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }

  /* ---------- controls (same as before) ---------- */
  function dragFrom(clientX) {
    const r = cv.getBoundingClientRect();
    const px = (clientX - r.left) * (W / r.width);
    dragX = Math.max(-0.95, Math.min(0.95, (px - CX) / (RW * TCAR)));
  }
  cv.addEventListener('pointerdown', e => { if (!running) { start(); return; } try { cv.setPointerCapture(e.pointerId); } catch (x) { } dragFrom(e.clientX); });
  cv.addEventListener('pointermove', e => { if (running && e.buttons > 0) dragFrom(e.clientX); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(n => cv.addEventListener(n, () => { dragX = null; }));

  const btnL = byId('gtrLeft'), btnR = byId('gtrRight'), btnN = byId('gtrNitro');
  const onLDown = e => { e.preventDefault(); dragX = null; steerDir = -1; };
  const onRDown = e => { e.preventDefault(); dragX = null; steerDir = 1; };
  const onUp = e => { e.preventDefault(); steerDir = 0; };
  btnL.addEventListener('pointerdown', onLDown); btnL.addEventListener('pointerup', onUp); btnL.addEventListener('pointerleave', onUp);
  btnR.addEventListener('pointerdown', onRDown); btnR.addEventListener('pointerup', onUp); btnR.addEventListener('pointerleave', onUp);
  const toggleNitro = on => { isNitro = on && nitro > 5; };
  btnN.addEventListener('pointerdown', e => { e.preventDefault(); toggleNitro(true); });
  btnN.addEventListener('pointerup', e => { e.preventDefault(); toggleNitro(false); });
  btnN.addEventListener('pointerleave', e => { e.preventDefault(); toggleNitro(false); });
  const onKey = e => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { steerDir = -1; dragX = null; e.preventDefault(); }
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { steerDir = 1; dragX = null; e.preventDefault(); }
    if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') { toggleNitro(true); e.preventDefault(); }
  };
  const onKeyUp = e => {
    if ((e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') && steerDir === -1) steerDir = 0;
    if ((e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') && steerDir === 1) steerDir = 0;
    if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') toggleNitro(false);
  };
  document.addEventListener('keydown', onKey); document.addEventListener('keyup', onKeyUp);

  byId('gtrStart').onclick = start;
  funCleanup = () => {
    alive = false; cancelAnimationFrame(raf);
    document.removeEventListener('keydown', onKey); document.removeEventListener('keyup', onKeyUp);
  };
  render(0);   // first frame, so she sees the neon city before pressing start
};

/* ---------- 🕊️ GAME 5: LOVE FLIGHT ---------- */
FUN.flight = body => {
  const W = 300, H = 280;
  const GOAL = gameOpt('flight', 'gates', 10, 3, 50);
  body.innerHTML = `<h3>Love Flight 🕊️</h3>
    <p class="fun-sub" id="flInfo">Tap anywhere to flap your wings through the enchanted rose gates 🌹 (Goal: ${GOAL} Gates)</p>
    <div style="position:relative; width:${W}px; margin:0 auto;">
      <canvas id="flCv" class="game-cv" width="${W}" height="${H}" style="cursor:pointer;"></canvas>
    </div>
    <div class="game-controls-row">
      <button class="game-ctrl-btn" id="flFlap" style="padding:9px 30px; font-size:0.95rem;">🕊️ Flap Wings</button>
    </div>
    <div class="fun-btn" id="flStart">Take Flight ▶️</div>`;

  const cv = byId('flCv'), ctx = cv.getContext('2d');
  let raf = 0, last = 0, running = false, alive = true;
  let birdY = H / 2, birdVy = 0;
  const birdX = 68;
  let gates = [], passed = 0, wingAngle = 0;
  let stars = [];

  for (let i = 0; i < 25; i++) {
    stars.push({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.5 + 0.5 });
  }

  /* 🕊️ the love-dove (faces right; about 26 x 20 px so the gates feel the same as before) */
  let trail = [], trailT = 0;
  function heartPath(c, x, y, k) {
    c.beginPath();
    c.moveTo(x, y + k * 0.9);
    c.bezierCurveTo(x - k * 1.6, y - k * 0.2, x - k * 0.9, y - k * 1.5, x, y - k * 0.5);
    c.bezierCurveTo(x + k * 0.9, y - k * 1.5, x + k * 1.6, y - k * 0.2, x, y + k * 0.9);
    c.closePath();
  }
  function drawWing(c, flap, far) {
    c.save();
    c.translate(-1, -2);
    c.rotate(flap * 0.85 - 0.1);                // up on the up-stroke, down on the down-stroke
    if (far) c.scale(0.86, 0.86);
    const wg = c.createLinearGradient(-17, -9, 0, 2);
    wg.addColorStop(0, far ? '#f9a8d4' : '#fbcfe8');
    wg.addColorStop(0.55, far ? '#fce7f3' : '#ffffff');
    wg.addColorStop(1, '#ffffff');
    c.fillStyle = wg;
    c.beginPath();
    c.moveTo(0, 0);
    c.bezierCurveTo(-3, -9, -12, -13, -18, -8);       // leading edge out to the tip
    c.bezierCurveTo(-14.5, -7, -13, -4.5, -14, -2);   // feather notches along the back edge
    c.bezierCurveTo(-11, -2.5, -9.5, 0, -10, 2);
    c.bezierCurveTo(-7, 1.5, -3.5, 3, 0, 0.5);
    c.closePath();
    c.fill();
    c.strokeStyle = 'rgba(244,114,182,0.55)'; c.lineWidth = 0.7; c.stroke();
    c.restore();
  }
  function drawBird(c, flap, k) {
    c.save();
    if (k && k !== 1) c.scale(k, k);
    const glow = c.createRadialGradient(0, 0, 2, 0, 0, 24);
    glow.addColorStop(0, 'rgba(255,150,190,0.35)'); glow.addColorStop(1, 'rgba(255,150,190,0)');
    c.fillStyle = glow; c.beginPath(); c.arc(0, 0, 24, 0, Math.PI * 2); c.fill();
    // tail feathers
    c.fillStyle = '#f9a8d4';
    [-0.5, 0, 0.5].forEach(a => {
      c.save(); c.translate(-8, 1.5); c.rotate(Math.PI + a * 0.7);
      c.beginPath(); c.ellipse(5.5, 0, 6.5, 2.1, 0, 0, Math.PI * 2); c.fill(); c.restore();
    });
    drawWing(c, -flap, true);                    // far wing flaps the other way, so it looks alive
    // body + head
    const bg = c.createLinearGradient(0, -8, 0, 9);
    bg.addColorStop(0, '#ffffff'); bg.addColorStop(1, '#fbd5e6');
    c.fillStyle = bg;
    c.beginPath(); c.ellipse(-1, 1.5, 10, 6.8, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(7, -3, 5.3, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255,100,150,0.55)';      // blush
    c.beginPath(); c.arc(8.6, -0.9, 1.7, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fbbf24';                     // golden beak
    c.beginPath(); c.moveTo(11.6, -4.2); c.lineTo(16.4, -2.5); c.lineTo(11.8, -1.2); c.closePath(); c.fill();
    c.fillStyle = '#1f1030';                     // eye with a sparkle
    c.beginPath(); c.arc(8.6, -4.4, 1.2, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(9, -4.8, 0.45, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ff4d6d';                     // little heart on its chest
    heartPath(c, 2.2, 3, 2.1); c.fill();
    drawWing(c, flap, false);                    // near wing on top
    c.restore();
  }

  function flap() {
    if (!running) { start(); return; }
    birdVy = -190;
    wingAngle = -0.5;
  }

  cv.addEventListener('pointerdown', flap);
  byId('flFlap').addEventListener('pointerdown', e => { e.preventDefault(); flap(); });
  const onKey = e => {
    if (e.key === ' ' || e.key === 'ArrowUp') { e.preventDefault(); flap(); }
  };
  document.addEventListener('keydown', onKey);

  function drawIntro() {
    const bgG = ctx.createLinearGradient(0, 0, 0, H);
    bgG.addColorStop(0, '#2d124d'); bgG.addColorStop(0.55, '#581c87'); bgG.addColorStop(1, '#be185d');
    ctx.fillStyle = bgG; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255, 235, 240, 0.7)';
    stars.forEach(s => ctx.fillRect(s.x, s.y, s.r, s.r));
    // the love-dove, bigger, wings mid-flap
    ctx.save();
    ctx.translate(W / 2, H / 2 - 5);
    drawBird(ctx, 0.5, 2.3);
    ctx.restore();
    ctx.font = 'bold 15px Poppins, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffdce3';
    ctx.fillText('ENCHANTED ROSE GATES 🌹', W / 2, 55);
    ctx.font = '600 13px Poppins, sans-serif'; ctx.fillStyle = '#ffd27a';
    ctx.fillText('▶ Tap to Take Flight 🕊️', W / 2, 80);
  }
  drawIntro();

  function start() {
    if (running) return;
    running = true; birdY = H / 2; birdVy = -140; gates = []; passed = 0; trail = []; trailT = 0;
    byId('flStart').style.display = 'none';
    byId('flInfo').textContent = 'Gliding through the clouds... Tap to rise! 🕊️';
    gates.push({ x: W + 30, top: 70, gap: 130, passed: false });
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }

  function loop(now) {
    if (!alive) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    birdVy += 480 * dt;
    birdY += birdVy * dt;
    wingAngle += 8 * dt;

    if (gates.length < 3) {
      const lastGate = gates[gates.length - 1];
      if (!lastGate || lastGate.x < W - 130) {
        const topH = 45 + Math.random() * (H - 180);
        gates.push({ x: W + 20, top: topH, gap: 125, passed: false });
      }
    }

    const bgG = ctx.createLinearGradient(0, 0, 0, H);
    bgG.addColorStop(0, '#2d124d'); bgG.addColorStop(0.55, '#581c87'); bgG.addColorStop(1, '#be185d');
    ctx.fillStyle = bgG;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = 'rgba(255, 235, 240, 0.7)';
    stars.forEach(s => ctx.fillRect(s.x, s.y, s.r, s.r));

    gates.forEach(g => {
      g.x -= 110 * dt;
      const topPillarG = ctx.createLinearGradient(g.x, 0, g.x + 32, 0);
      topPillarG.addColorStop(0, '#831843'); topPillarG.addColorStop(0.5, '#db2777'); topPillarG.addColorStop(1, '#831843');
      ctx.fillStyle = topPillarG;
      ctx.fillRect(g.x, 0, 32, g.top);
      ctx.font = '18px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🌹', g.x + 16, g.top - 10);

      const botY = g.top + g.gap;
      const botH = H - botY;
      ctx.fillStyle = topPillarG;
      ctx.fillRect(g.x, botY, 32, botH);
      ctx.fillText('🌹', g.x + 16, botY + 10);

      if (!g.passed) {
        ctx.font = '14px serif';
        ctx.fillText('✨', g.x + 16, g.top + g.gap / 2);
      }

      if (!g.passed && g.x + 32 < birdX) {
        g.passed = true;
        passed++;
        if (window.PLUS) PLUS.hit('good');
        burstAt(birdX, birdY, 4);
      }

      if (birdX + 9 > g.x && birdX - 9 < g.x + 32) {
        if (birdY - 9 < g.top || birdY + 9 > botY) {
          endFail();
        }
      }
    });

    gates = gates.filter(g => g.x > -40);

    if (birdY < 10 || birdY > H - 12) {
      endFail();
      return;
    }

    // trail of little hearts behind the dove (skipped on weak phones)
    trailT -= dt;
    if (trailT <= 0 && !LITE) { trailT = 0.16; trail.push({ x: birdX - 13, y: birdY + 2, a: 1 }); }
    trail = trail.filter(t => {
      t.x -= 110 * dt; t.a -= dt * 1.4;
      if (t.a <= 0) return false;
      ctx.globalAlpha = Math.max(0, t.a) * 0.8;
      ctx.fillStyle = '#ff8fb1';
      heartPath(ctx, t.x, t.y, 1.4 + t.a * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      return true;
    });

    ctx.save();
    ctx.translate(birdX, birdY);
    ctx.rotate(Math.max(-0.4, Math.min(0.5, birdVy * 0.002)));
    drawBird(ctx, Math.sin(wingAngle));
    ctx.restore();

    ctx.font = 'bold 13px Poppins, sans-serif';
    ctx.fillStyle = '#ffffff'; ctx.textAlign = 'left';
    ctx.fillText(`🌹 Gates: ${passed} / ${GOAL}`, 10, 20);

    if (passed >= GOAL) {
      running = false;
      byId('flStart').textContent = 'Fly again 🕊️';
      byId('flStart').style.display = '';
      byId('flInfo').textContent = `Glorious flight! You passed all ${GOAL} gates 💕`;
      setTimeout(() => celebrate(
        'Through every distance and every sky, my heart will always fly straight to you 🕊️💕',
        `✨ ${GOAL} enchanted gates passed with grace`
      ), 700);
      return;
    }

    raf = requestAnimationFrame(loop);
  }

  function endFail() {
    if (window.PLUS) PLUS.hit('bad');
    running = false;
    byId('flStart').textContent = 'Try again 🕊️';
    byId('flStart').style.display = '';
    byId('flInfo').textContent = `Gate count: ${passed}. Hearts are brave—take to the skies once more 💕`;
  }

  byId('flStart').onclick = start;
  funCleanup = () => {
    alive = false;
    cancelAnimationFrame(raf);
    document.removeEventListener('keydown', onKey);
  };
};

/* ---------- 🧱 GAME 6: LOVE BREAKER ---------- */
FUN.breaker = body => {
  const W = 300, H = 280;
  const LIVES = gameOpt('breaker', 'lives', 3, 1, 9);
  body.innerHTML = `<h3>Love Breaker 🧱</h3>
    <p class="fun-sub" id="brkInfo">Slide the paddle to bounce the heart & clear all love blocks 💖 (Clear all 24 blocks)</p>
    <div style="position:relative; width:${W}px; margin:0 auto;">
      <canvas id="brkCv" class="game-cv" width="${W}" height="${H}" style="cursor:pointer;"></canvas>
    </div>
    <div class="game-controls-row">
      <button class="game-ctrl-btn" id="brkLeft">◀ Slide</button>
      <button class="game-ctrl-btn" id="brkRight">Slide ▶</button>
    </div>
    <div class="fun-btn" id="brkStart">Start Game 🧱</div>`;

  const cv = byId('brkCv'), ctx = cv.getContext('2d');
  let raf = 0, last = 0, running = false, alive = true;

  // Paddle
  let padW = 66;
  const padH = 11, padY = H - 26;
  let padX = (W - padW) / 2, padTargetX = padX;

  // Balls
  let balls = [];
  // Bricks (4 rows x 6 cols = 24 bricks)
  let bricks = [];
  let drops = [];
  let lives = LIVES;
  let steerDir = 0;

  function safeRoundRect(c, x, y, w, h, r) {
    if (c.roundRect) {
      c.beginPath(); c.roundRect(x, y, w, h, r); c.fill();
    } else {
      c.beginPath(); c.rect(x, y, w, h); c.fill();
    }
  }

  function initBricks() {
    bricks = [];
    const rows = 4, cols = 6;
    const bW = 42, bH = 13, padTop = 32, padSide = 17;
    const colors = ['#f43f5e', '#fbbf24', '#c084fc', '#fb7185'];
    const icons = ['❤️', '✨', '🎀', '💎', '💖', '⭐'];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        bricks.push({
          x: padSide + c * (bW + 4),
          y: padTop + r * (bH + 5),
          w: bW, h: bH,
          color: colors[r],
          icon: icons[(r + c) % icons.length],
          alive: true
        });
      }
    }
  }

  function setPaddleFromClientX(clientX) {
    if (!running) return;
    const r = cv.getBoundingClientRect();
    const x = (clientX - r.left) * (W / r.width);
    padTargetX = Math.max(8, Math.min(W - padW - 8, x - padW / 2));
  }
  cv.addEventListener('pointermove', e => setPaddleFromClientX(e.clientX));
  cv.addEventListener('pointerdown', e => {
    if (!running) start();
    else setPaddleFromClientX(e.clientX);
  });

  const btnL = byId('brkLeft'), btnR = byId('brkRight');
  const onLDown = e => { e.preventDefault(); steerDir = -1; };
  const onRDown = e => { e.preventDefault(); steerDir = 1; };
  const onUp = e => { e.preventDefault(); steerDir = 0; };
  btnL.addEventListener('pointerdown', onLDown);
  btnL.addEventListener('pointerup', onUp);
  btnL.addEventListener('pointerleave', onUp);
  btnR.addEventListener('pointerdown', onRDown);
  btnR.addEventListener('pointerup', onUp);
  btnR.addEventListener('pointerleave', onUp);

  const onKey = e => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { steerDir = -1; e.preventDefault(); }
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { steerDir = 1; e.preventDefault(); }
  };
  const onKeyUp = e => {
    if ((e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') && steerDir === -1) steerDir = 0;
    if ((e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') && steerDir === 1) steerDir = 0;
  };
  document.addEventListener('keydown', onKey);
  document.addEventListener('keyup', onKeyUp);

  function drawIntro() {
    initBricks();
    ctx.fillStyle = '#14081c'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    bricks.forEach(b => {
      ctx.fillStyle = b.color;
      safeRoundRect(ctx, b.x, b.y, b.w, b.h, 4);
      ctx.font = '9px serif';
      ctx.fillText(b.icon, b.x + b.w / 2, b.y + b.h / 2 + 1);
    });
    // Paddle & Ball
    const padG = ctx.createLinearGradient(padX, 0, padX + padW, 0);
    padG.addColorStop(0, '#ff4d6d'); padG.addColorStop(0.5, '#ff8fa3'); padG.addColorStop(1, '#ff4d6d');
    ctx.fillStyle = padG; safeRoundRect(ctx, padX, padY, padW, padH, 6);
    ctx.fillStyle = '#ff4d6d'; ctx.beginPath(); ctx.arc(W / 2, padY - 8, 6, 0, Math.PI * 2); ctx.fill();
    ctx.font = '600 13px Poppins, sans-serif'; ctx.fillStyle = '#ffd27a';
    ctx.fillText('▶ Tap to Start Breaker 🧱', W / 2, H / 2 + 30);
  }
  drawIntro();

  function start() {
    if (running) return;
    running = true; lives = LIVES; padW = 66; padX = (W - padW) / 2; padTargetX = padX;
    drops = [];
    initBricks();
    balls = [{ x: W / 2, y: padY - 12, vx: 130, vy: -180, r: 6 }];
    byId('brkStart').style.display = 'none';
    byId('brkInfo').textContent = 'Keep the heart bouncing and clear the bricks 💖';
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }

  function loop(now) {
    if (!alive) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    if (steerDir !== 0) padTargetX += steerDir * 250 * dt;
    padTargetX = Math.max(8, Math.min(W - padW - 8, padTargetX));
    padX += (padTargetX - padX) * (18 * dt);

    ctx.fillStyle = '#14081c';
    ctx.fillRect(0, 0, W, H);

    let activeBricks = 0;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    bricks.forEach(b => {
      if (!b.alive) return;
      activeBricks++;
      ctx.fillStyle = b.color;
      safeRoundRect(ctx, b.x, b.y, b.w, b.h, 4);
      ctx.font = '9px serif';
      ctx.fillText(b.icon, b.x + b.w / 2, b.y + b.h / 2 + 1);
    });

    drops = drops.filter(d => {
      d.y += 90 * dt;
      if (d.y > padY && d.y < padY + padH && d.x > padX && d.x < padX + padW) {
        if (d.type === 'heart') {
          lives = Math.min(Math.max(5, LIVES + 2), lives + 1);
          if (window.PLUS) PLUS.sfx('pickup');
          burstAt(d.x, d.y, 6);
        } else if (d.type === 'wide') {
          padW = Math.min(92, padW + 16);
        } else if (d.type === 'ball') {
          balls.push({ x: padX + padW / 2, y: padY - 12, vx: (Math.random() - 0.5) * 200, vy: -170, r: 6 });
        }
        return false;
      }
      ctx.font = '15px serif';
      ctx.fillText(d.type === 'heart' ? '💖' : d.type === 'wide' ? '📏' : '⭐', d.x, d.y);
      return d.y < H + 20;
    });

    for (let i = balls.length - 1; i >= 0; i--) {
      const b = balls[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      if (b.x - b.r < 4) { b.x = 4 + b.r; b.vx = Math.abs(b.vx); }
      if (b.x + b.r > W - 4) { b.x = W - 4 - b.r; b.vx = -Math.abs(b.vx); }
      if (b.y - b.r < 14) { b.y = 14 + b.r; b.vy = Math.abs(b.vy); }

      if (b.y + b.r >= padY && b.y - b.r <= padY + padH && b.x >= padX - 4 && b.x <= padX + padW + 4 && b.vy > 0) {
        b.y = padY - b.r;
        const hitNorm = (b.x - (padX + padW / 2)) / (padW / 2);
        const speed = Math.hypot(b.vx, b.vy);
        const maxAngle = 1.1;
        const angle = hitNorm * maxAngle;
        b.vx = speed * Math.sin(angle);
        b.vy = -speed * Math.cos(angle);
        burstAt(b.x, b.y, 3);
      }

      for (const brk of bricks) {
        if (!brk.alive) continue;
        if (b.x + b.r > brk.x && b.x - b.r < brk.x + brk.w && b.y + b.r > brk.y && b.y - b.r < brk.y + brk.h) {
          brk.alive = false;
          if (window.PLUS) PLUS.hit('good');
          b.vy = -b.vy;
          burstAt(brk.x + brk.w / 2, brk.y + brk.h / 2, 4);

          if (Math.random() < 0.24) {
            const types = ['heart', 'wide', 'ball'];
            drops.push({ x: brk.x + brk.w / 2, y: brk.y + brk.h / 2, type: types[Math.floor(Math.random() * types.length)] });
          }
          break;
        }
      }

      if (b.y > H + 10) {
        balls.splice(i, 1);
        continue;
      }

      ctx.fillStyle = '#ff4d6d';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(b.x - 2, b.y - 2, 1.8, 0, Math.PI * 2); ctx.fill();
    }

    if (balls.length === 0) {
      lives--;
      if (window.PLUS) PLUS.hit('bad');
      if (lives > 0) {
        balls = [{ x: padX + padW / 2, y: padY - 12, vx: 130, vy: -180, r: 6 }];
      } else {
        running = false;
        byId('brkStart').textContent = 'Play again 🔄';
        byId('brkStart').style.display = '';
        byId('brkInfo').textContent = 'Love never gives up! Try again 💕';
        return;
      }
    }

    const padG = ctx.createLinearGradient(padX, 0, padX + padW, 0);
    padG.addColorStop(0, '#ff4d6d'); padG.addColorStop(0.5, '#ff8fa3'); padG.addColorStop(1, '#ff4d6d');
    ctx.fillStyle = padG;
    safeRoundRect(ctx, padX, padY, padW, padH, 6);

    ctx.font = 'bold 12px Poppins, sans-serif';
    ctx.fillStyle = '#ffb6c1'; ctx.textAlign = 'left';
    ctx.fillText('❤️'.repeat(lives), 10, 18);
    ctx.textAlign = 'right';
    ctx.fillText(`Blocks: ${activeBricks}`, W - 10, 18);

    if (activeBricks === 0) {
      running = false;
      byId('brkStart').textContent = 'Play again 🔄';
      byId('brkStart').style.display = '';
      byId('brkInfo').textContent = 'Every block cleared in love! Outstanding! 💖';
      setTimeout(() => celebrate(
        'You broke through every block, just as your smile brightens up my whole world 🧱💖',
        '🏆 All 24 blocks cleared in victory'
      ), 700);
      return;
    }

    raf = requestAnimationFrame(loop);
  }

  byId('brkStart').onclick = start;
  funCleanup = () => {
    alive = false;
    cancelAnimationFrame(raf);
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('keyup', onKeyUp);
  };
};
