/* 🎮 Big games (GT-R, Love Flight, Love Breaker): loaded only when she taps their tile, so the first open stays light. */
/* ---------- 🏎️ GAME 4: NISSAN GT-R R34 MIDNIGHT RUN ---------- */
FUN.gtr = body => {
  const W = 300, H = 280;
  const GTR_M = gameOpt('gtr', 'distance', 1000, 200, 10000), GTR_H = gameOpt('gtr', 'hearts', 15, 3, 100);
  body.innerHTML = `<h3>Skyline GT-R R34 🏎️</h3>
    <p class="fun-sub" id="gtrInfo">Cruise the midnight highway in the legendary R34! Catch 💖 & hit 🚀 NITRO! (Goal: ${GTR_M}m or ${GTR_H} 💖)</p>
    <div style="position:relative; width:${W}px; margin:0 auto;">
      <canvas id="gtrCv" class="game-cv" width="${W}" height="${H}" style="cursor:pointer;"></canvas>
    </div>
    <div class="game-controls-row">
      <button class="game-ctrl-btn" id="gtrLeft">◀ Left</button>
      <button class="game-ctrl-btn nitro-btn" id="gtrNitro">🚀 NITRO</button>
      <button class="game-ctrl-btn" id="gtrRight">Right ▶</button>
    </div>
    <div class="fun-btn" id="gtrStart">Start Engine 🏎️</div>`;

  const cv = byId('gtrCv'), ctx = cv.getContext('2d');
  let raf = 0, last = 0, running = false, alive = true;
  let carX = W / 2, carTargetX = W / 2;
  const carY = H - 65;
  const carW = 32, carH = 62;

  let distance = 0;       // target 1000m
  let hearts = 0;         // target 15
  let nitro = 100;        // 0 to 100
  let isNitro = false;
  let invulnerable = 0;   // seconds of invulnerability
  let roadOffset = 0;
  let traffic = [];
  let pickups = [];
  let particles = [];
  let spawnTimer = 0;
  let pickupTimer = 0;
  let steerDir = 0;

  function safeRoundRect(c, x, y, w, h, r) {
    if (c.roundRect) {
      c.beginPath(); c.roundRect(x, y, w, h, r); c.fill();
    } else {
      c.beginPath(); c.rect(x, y, w, h); c.fill();
    }
  }

  // Pointer / Touch drag controls
  function setCarFromClientX(clientX) {
    if (!running) return;
    const r = cv.getBoundingClientRect();
    const x = (clientX - r.left) * (W / r.width);
    carTargetX = Math.max(55, Math.min(W - 55, x));
  }
  cv.addEventListener('pointermove', e => { if (e.buttons > 0) setCarFromClientX(e.clientX); });
  cv.addEventListener('pointerdown', e => {
    if (!running) start();
    else setCarFromClientX(e.clientX);
  });

  // Button controls
  const btnL = byId('gtrLeft'), btnR = byId('gtrRight'), btnN = byId('gtrNitro');
  const onLDown = e => { e.preventDefault(); steerDir = -1; };
  const onRDown = e => { e.preventDefault(); steerDir = 1; };
  const onUp = e => { e.preventDefault(); steerDir = 0; };
  btnL.addEventListener('pointerdown', onLDown);
  btnL.addEventListener('pointerup', onUp);
  btnL.addEventListener('pointerleave', onUp);
  btnR.addEventListener('pointerdown', onRDown);
  btnR.addEventListener('pointerup', onUp);
  btnR.addEventListener('pointerleave', onUp);

  const toggleNitro = on => { isNitro = on && nitro > 5; };
  btnN.addEventListener('pointerdown', e => { e.preventDefault(); toggleNitro(true); });
  btnN.addEventListener('pointerup', e => { e.preventDefault(); toggleNitro(false); });
  btnN.addEventListener('pointerleave', e => { e.preventDefault(); toggleNitro(false); });

  // Keyboard controls
  const onKey = e => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { steerDir = -1; e.preventDefault(); }
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { steerDir = 1; e.preventDefault(); }
    if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') { toggleNitro(true); e.preventDefault(); }
  };
  const onKeyUp = e => {
    if ((e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') && steerDir === -1) steerDir = 0;
    if ((e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') && steerDir === 1) steerDir = 0;
    if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') toggleNitro(false);
  };
  document.addEventListener('keydown', onKey);
  document.addEventListener('keyup', onKeyUp);

  function start() {
    if (running) return;
    running = true; distance = 0; hearts = 0; nitro = 100;
    isNitro = false; invulnerable = 0; traffic = []; pickups = []; particles = [];
    carX = W / 2; carTargetX = W / 2; steerDir = 0;
    byId('gtrStart').style.display = 'none';
    byId('gtrInfo').textContent = 'Hold NITRO for 280+ km/h! Dodge traffic & catch hearts 💖';
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }

  // Draw authentic Nissan Skyline GT-R R34 (Bayside Blue)
  function drawGTR(c, x, y, nitroOn, invuln) {
    if (invuln > 0 && Math.floor(invuln * 14) % 2 === 0) return; // Flash effect when hit
    c.save();
    c.translate(x, y);

    // Subtle drift rotation
    const tilt = (carTargetX - carX) * 0.035;
    c.rotate(Math.max(-0.16, Math.min(0.16, tilt)));

    // Forward Xenon Light Beams
    const beamG = c.createLinearGradient(0, -carH / 2, 0, -carH / 2 - 100);
    beamG.addColorStop(0, 'rgba(224, 242, 254, 0.4)');
    beamG.addColorStop(0.3, 'rgba(186, 230, 253, 0.18)');
    beamG.addColorStop(1, 'rgba(186, 230, 253, 0)');
    c.fillStyle = beamG;
    c.beginPath();
    c.moveTo(-carW / 2 + 4, -carH / 2);
    c.lineTo(-carW / 2 - 20, -carH / 2 - 100);
    c.lineTo(carW / 2 + 20, -carH / 2 - 100);
    c.lineTo(carW / 2 - 4, -carH / 2);
    c.closePath();
    c.fill();

    // Shadow
    c.fillStyle = 'rgba(0, 0, 0, 0.55)';
    safeRoundRect(c, -carW / 2 - 2, -carH / 2 + 2, carW + 4, carH, 8);

    // 4 Wide Sports Wheels / Tires
    c.fillStyle = '#111827';
    c.fillRect(-carW / 2 - 3, -carH / 2 + 8, 4, 11);  // Front Left
    c.fillRect(carW / 2 - 1, -carH / 2 + 8, 4, 11);   // Front Right
    c.fillRect(-carW / 2 - 3, carH / 2 - 19, 4, 12);  // Rear Left
    c.fillRect(carW / 2 - 1, carH / 2 - 19, 4, 12);   // Rear Right

    // Metallic Bayside Blue Main Body
    const bodyG = c.createLinearGradient(-carW / 2, 0, carW / 2, 0);
    bodyG.addColorStop(0, '#103678');
    bodyG.addColorStop(0.2, '#1d4ed8');
    bodyG.addColorStop(0.5, '#3b82f6');
    bodyG.addColorStop(0.8, '#1d4ed8');
    bodyG.addColorStop(1, '#103678');
    c.fillStyle = bodyG;
    safeRoundRect(c, -carW / 2, -carH / 2, carW, carH, 6);

    // Front Bumper Splitter & Aggressive Grille
    c.fillStyle = '#090d16';
    c.fillRect(-carW / 2 + 3, -carH / 2, carW - 6, 4);

    // GT-R Front Red/Chrome Badge
    c.fillStyle = '#ef4444';
    c.fillRect(-1.5, -carH / 2 + 1, 3, 2);

    // Hood Sculpt / NACA Air Vents
    c.fillStyle = '#0a1d38';
    c.fillRect(-carW / 2 + 6, -carH / 2 + 6, 5, 7);
    c.fillRect(carW / 2 - 11, -carH / 2 + 6, 5, 7);
    // Center hood crease
    c.strokeStyle = 'rgba(147, 197, 253, 0.4)';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(0, -carH / 2 + 3);
    c.lineTo(0, -carH / 2 + 18);
    c.stroke();

    // Twin Xenon Headlights
    c.fillStyle = '#e0f2fe';
    safeRoundRect(c, -carW / 2 + 2, -carH / 2 + 1, 5, 4, 2);
    safeRoundRect(c, carW / 2 - 7, -carH / 2 + 1, 5, 4, 2);

    // Tinted Coupe Cockpit Glass
    c.fillStyle = '#060a12';
    safeRoundRect(c, -carW / 2 + 4, -carH / 2 + 19, carW - 8, 27, 4);

    // Windshield diagonal reflection gloss
    c.fillStyle = 'rgba(255, 255, 255, 0.3)';
    c.beginPath();
    c.moveTo(-carW / 2 + 6, -carH / 2 + 20);
    c.lineTo(-carW / 2 + 12, -carH / 2 + 20);
    c.lineTo(-carW / 2 + 5, -carH / 2 + 33);
    c.closePath();
    c.fill();

    // Coupe Roof (Bayside Blue)
    c.fillStyle = bodyG;
    safeRoundRect(c, -carW / 2 + 6, -carH / 2 + 24, carW - 12, 14, 2);

    // Rear Window Glass
    c.fillStyle = '#060a12';
    c.fillRect(-carW / 2 + 5, -carH / 2 + 39, carW - 10, 5);

    // Rear Trunk Deck & High GT-R Spoiler / Wing
    c.fillStyle = '#0b192e';
    c.fillRect(-carW / 2 + 4, carH / 2 - 11, 3, 7); // Pedestal L
    c.fillRect(carW / 2 - 7, carH / 2 - 11, 3, 7);  // Pedestal R
    // Wing blade & endplates
    c.fillStyle = '#143c74';
    c.fillRect(-carW / 2 + 1, carH / 2 - 7, carW - 2, 5);
    c.fillStyle = '#071324';
    c.fillRect(-carW / 2, carH / 2 - 9, 3, 8);
    c.fillRect(carW / 2 - 3, carH / 2 - 9, 3, 8);

    // 🔴🔴 SIGNATURE R34 DUAL ROUND TAILLIGHTS 🔴🔴
    const drawTailCircle = (tx, ty, rOut, rIn) => {
      c.fillStyle = '#ef4444';
      c.beginPath(); c.arc(tx, ty, rOut, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fca5a5';
      c.beginPath(); c.arc(tx, ty, rIn, 0, Math.PI * 2); c.fill();
    };
    // Left pair (Outer circle, Inner circle)
    drawTailCircle(-carW / 2 + 6, carH / 2 - 1, 3.2, 1.5);
    drawTailCircle(-carW / 2 + 12, carH / 2 - 1, 2.6, 1.2);
    // Right pair (Inner circle, Outer circle)
    drawTailCircle(carW / 2 - 12, carH / 2 - 1, 2.6, 1.2);
    drawTailCircle(carW / 2 - 6, carH / 2 - 1, 3.2, 1.5);

    // Chrome Exhaust Tips
    c.fillStyle = '#94a3b8';
    c.fillRect(-carW / 2 + 5, carH / 2, 3, 2);
    c.fillRect(carW / 2 - 8, carH / 2, 3, 2);

    // NITRO EXHAUST FLAMES
    if (nitroOn) {
      const flLen = 15 + Math.random() * 18;
      const flW = 5 + Math.random() * 3;
      [-carW / 2 + 6.5, carW / 2 - 6.5].forEach(exX => {
        // Outer fire
        c.fillStyle = Math.random() < 0.5 ? '#f97316' : '#ec4899';
        c.beginPath();
        c.moveTo(exX - flW / 2, carH / 2 + 2);
        c.lineTo(exX, carH / 2 + 2 + flLen);
        c.lineTo(exX + flW / 2, carH / 2 + 2);
        c.closePath();
        c.fill();
        // Inner blue-hot core
        c.fillStyle = '#38bdf8';
        c.beginPath();
        c.moveTo(exX - flW / 4, carH / 2 + 2);
        c.lineTo(exX, carH / 2 + 2 + flLen * 0.6);
        c.lineTo(exX + flW / 4, carH / 2 + 2);
        c.closePath();
        c.fill();
      });
    }

    c.restore();
  }

  // Draw Traffic Car
  function drawTrafficCar(c, car) {
    c.save();
    c.translate(car.x, car.y);
    c.fillStyle = 'rgba(0, 0, 0, 0.45)';
    safeRoundRect(c, -car.w / 2 - 1, -car.h / 2 + 2, car.w + 2, car.h, 6);
    c.fillStyle = car.color;
    safeRoundRect(c, -car.w / 2, -car.h / 2, car.w, car.h, 5);
    // Windows
    c.fillStyle = '#0f172a';
    safeRoundRect(c, -car.w / 2 + 3, -car.h / 2 + 13, car.w - 6, car.h - 26, 3);
    // Roof
    c.fillStyle = car.color;
    safeRoundRect(c, -car.w / 2 + 4, -car.h / 2 + 17, car.w - 8, car.h - 34, 2);
    // Taillights
    c.fillStyle = '#ef4444';
    c.fillRect(-car.w / 2 + 2, car.h / 2 - 3, 5, 2);
    c.fillRect(car.w / 2 - 7, car.h / 2 - 3, 5, 2);
    c.restore();
  }

  // Intro preview screen
  function drawIntro() {
    ctx.fillStyle = '#0a0d18';
    ctx.fillRect(0, 0, W, H);
    // Skyline
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(20, 10, 32, 28); ctx.fillRect(70, 4, 42, 34); ctx.fillRect(180, 8, 38, 30);
    // Road
    ctx.fillStyle = '#13141f';
    ctx.fillRect(35, 38, W - 70, H - 38);
    ctx.fillStyle = '#06b6d4'; ctx.fillRect(33, 38, 3, H - 38);
    ctx.fillStyle = '#ec4899'; ctx.fillRect(W - 36, 38, 3, H - 38);
    // Lane lines
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    [112, 188].forEach(lx => {
      for (let y = 45; y < H; y += 38) ctx.fillRect(lx - 2, y, 4, 20);
    });
    // Parked GT-R R34
    drawGTR(ctx, W / 2, H / 2 + 15, false, 0);
    // Intro overlay text
    ctx.font = 'bold 15px Poppins, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffdce3';
    ctx.fillText('NISSAN SKYLINE GT-R R34', W / 2, 60);
    ctx.font = '600 13px Poppins, sans-serif';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('▶ Tap to Start Engine 🏁', W / 2, 85);
  }
  drawIntro();

  // Main Game Loop
  function loop(now) {
    if (!alive) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    // Smooth steering input
    if (steerDir !== 0) carTargetX += steerDir * 230 * dt;
    carTargetX = Math.max(55, Math.min(W - 55, carTargetX));
    carX += (carTargetX - carX) * (14 * dt);

    // Nitro handling
    if (isNitro && nitro > 0) {
      nitro = Math.max(0, nitro - 28 * dt);
      if (nitro <= 0) isNitro = false;
    } else {
      nitro = Math.min(100, nitro + 6 * dt);
    }

    const currentSpeedKmH = isNitro ? 284 : 162;
    const currentSpeedPx = isNitro ? 520 : 280;
    distance += (currentSpeedKmH * (1000 / 3600)) * dt;
    roadOffset = (roadOffset + currentSpeedPx * dt) % 38;

    if (invulnerable > 0) invulnerable -= dt;

    // Traffic spawning
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnTimer = Math.max(0.85, 1.7 - (distance / 1200) * 0.7);
      const lanes = [75, 150, 225];
      const lx = lanes[Math.floor(Math.random() * lanes.length)];
      const colors = ['#e11d48', '#f8fafc', '#eab308', '#10b981', '#a855f7'];
      traffic.push({
        x: lx, y: -50, w: 30, h: 50,
        color: colors[Math.floor(Math.random() * colors.length)],
        speed: 110 + Math.random() * 40
      });
    }

    // Pickups spawning
    pickupTimer -= dt;
    if (pickupTimer <= 0) {
      pickupTimer = 1.3;
      const lx = 60 + Math.random() * (W - 120);
      const isHeart = Math.random() < 0.65;
      pickups.push({ x: lx, y: -25, isHeart, r: 12 });
    }

    // Screen Shake when in NITRO
    let shakeX = 0, shakeY = 0;
    if (isNitro) {
      shakeX = (Math.random() - 0.5) * 3;
      shakeY = (Math.random() - 0.5) * 3;
    }

    ctx.save();
    ctx.translate(shakeX, shakeY);
    ctx.clearRect(-10, -10, W + 20, H + 20);

    // 1. Midnight Background & Road
    ctx.fillStyle = '#0a0d18';
    ctx.fillRect(0, 0, W, H);

    // City Skyline at horizon
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, 36);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(20, 8, 32, 28); ctx.fillRect(70, 4, 42, 32); ctx.fillRect(135, 12, 28, 24);
    ctx.fillRect(180, 6, 38, 30); ctx.fillRect(235, 14, 45, 22);
    ctx.fillStyle = '#fef08a';
    for (let wy = 10; wy < 32; wy += 7) {
      ctx.fillRect(78, wy, 3, 3); ctx.fillRect(92, wy, 3, 3);
      ctx.fillRect(190, wy, 3, 3); ctx.fillRect(202, wy, 3, 3);
    }

    // Asphalt Road
    ctx.fillStyle = '#13141f';
    ctx.fillRect(35, 36, W - 70, H - 36);

    // Neon Guardrails
    ctx.fillStyle = '#06b6d4'; ctx.fillRect(33, 36, 3, H - 36);
    ctx.fillStyle = '#ec4899'; ctx.fillRect(W - 36, 36, 3, H - 36);

    // Scrolling Lane Dividers
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    [112, 188].forEach(lx => {
      for (let y = -38 + roadOffset; y < H; y += 38) {
        ctx.fillRect(lx - 2, y, 4, 20);
      }
    });

    // 2. Pickups
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    pickups = pickups.filter(p => {
      p.y += currentSpeedPx * dt;
      if (Math.abs(p.x - carX) < 25 && Math.abs(p.y - carY) < 30) {
        if (p.isHeart) {
          hearts++;
          if (window.PLUS) PLUS.hit('good');
          particles.push({ x: p.x, y: p.y, text: '+1 💖', life: 1 });
          burstAt(p.x, p.y, 6);
        } else {
          nitro = Math.min(100, nitro + 45);
          if (window.PLUS) PLUS.sfx('pickup');
          particles.push({ x: p.x, y: p.y, text: '+NOS ⚡', life: 1 });
        }
        return false;
      }
      ctx.font = '20px serif';
      ctx.fillText(p.isHeart ? '💖' : '⚡', p.x, p.y);
      return p.y < H + 30;
    });

    // 3. Traffic
    traffic = traffic.filter(t => {
      t.y += (currentSpeedPx - t.speed) * dt;
      if (invulnerable <= 0 && Math.abs(t.x - carX) < 26 && Math.abs(t.y - carY) < 46) {
        invulnerable = 1.2;
        burstAt(carX, carY, 10);
        particles.push({ x: carX, y: carY, text: '💥 BUMP!', life: 0.8 });
        isNitro = false;
        t.y += 28;
      }
      drawTrafficCar(ctx, t);
      return t.y < H + 60 && t.y > -80;
    });

    // 4. Text Particles
    particles = particles.filter(pt => {
      pt.y -= 38 * dt;
      pt.life -= dt;
      ctx.font = 'bold 14px Poppins, sans-serif';
      ctx.fillStyle = `rgba(255, 220, 230, ${Math.max(0, pt.life)})`;
      ctx.fillText(pt.text, pt.x, pt.y);
      return pt.life > 0;
    });

    // 5. Draw Nissan GT-R R34
    drawGTR(ctx, carX, carY, isNitro, invulnerable);

    // 6. HUD
    ctx.font = 'bold 13px Poppins, sans-serif';
    ctx.fillStyle = isNitro ? '#38bdf8' : '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(`${Math.round(currentSpeedKmH)} KM/H 🏎️`, 10, 18);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#ff758c';
    ctx.fillText(`💖 ${hearts}/${GTR_H}  |  🏁 ${Math.min(GTR_M, Math.floor(distance))}m`, W - 10, 18);

    // Nitro Bar
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(10, H - 14, W - 20, 9);
    const nG = ctx.createLinearGradient(10, 0, W - 10, 0);
    nG.addColorStop(0, '#06b6d4'); nG.addColorStop(1, '#3b82f6');
    ctx.fillStyle = nG;
    ctx.fillRect(10, H - 14, (W - 20) * (nitro / 100), 9);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.strokeRect(10, H - 14, W - 20, 9);

    ctx.restore();

    // Check Win
    if (distance >= GTR_M || hearts >= GTR_H) {
      running = false;
      const b = byId('gtrStart');
      b.textContent = 'Drive again 🏎️'; b.style.display = '';
      byId('gtrInfo').textContent = `Mission Complete! Distance: ${Math.floor(distance)}m, Hearts: ${hearts} 💕`;
      setTimeout(() => celebrate(
        'You conquered the midnight highway in the Nissan GT-R R34, but my heart was already racing for you at 300 km/h 🏎️💨',
        `🏁 ${Math.floor(distance)}m conquered | 💖 ${hearts} hearts collected`
      ), 700);
      return;
    }

    raf = requestAnimationFrame(loop);
  }

  byId('gtrStart').onclick = start;
  funCleanup = () => {
    alive = false;
    cancelAnimationFrame(raf);
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('keyup', onKeyUp);
  };
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
