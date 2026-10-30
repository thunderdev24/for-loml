/*
 * Romantic Aero Shards
 * Lightweight vanilla-JS canvas adaptation for this project's plain HTML page.
 * No React, bundler, or external dependency required.
 */
(() => {
  const screen = document.getElementById("roseScreen");
  const canvas = document.getElementById("roseShardsCanvas");
  if (!screen || !canvas) return;

  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const shards = [];
  const count = window.innerWidth < 600 ? 38 : 72;
  let width = 0, height = 0, dpr = 1, raf = 0, last = 0;
  let pulse = 0;

  const rand = (min, max) => min + Math.random() * (max - min);

  function resize() {
    const rect = screen.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    shards.length = 0;
    for (let i = 0; i < count; i++) {
      const depth = rand(.25, 1);
      shards.push({
        x: rand(-width * .12, width * 1.12),
        y: rand(-height * .15, height * 1.15),
        len: rand(22, 105) * depth,
        thick: rand(2, 10) * depth,
        angle: rand(-Math.PI, Math.PI),
        drift: rand(-.12, .12),
        speed: rand(.08, .36) * (reduceMotion ? .15 : 1),
        alpha: rand(.12, .48) * depth,
        depth,
        hue: rand(-8, 10)
      });
    }
  }

  function drawShard(s, t) {
    const parallaxX = pointer.x * 13 * s.depth;
    const parallaxY = pointer.y * 10 * s.depth;
    const x = s.x + parallaxX;
    const y = s.y + parallaxY;
    const wobble = Math.sin(t * .00045 + s.x * .013) * .12;
    const a = s.angle + wobble;
    const dx = Math.cos(a) * s.len;
    const dy = Math.sin(a) * s.len;
    const nx = -Math.sin(a) * s.thick;
    const ny = Math.cos(a) * s.thick;

    const grad = ctx.createLinearGradient(x - dx / 2, y - dy / 2, x + dx / 2, y + dy / 2);
    grad.addColorStop(0, `rgba(255, 220, 218, ${s.alpha * .12})`);
    grad.addColorStop(.45, `rgba(236, 166, 177, ${s.alpha * .52})`);
    grad.addColorStop(1, `rgba(255, 239, 220, ${s.alpha * .22})`);

    ctx.beginPath();
    ctx.moveTo(x - dx / 2 - nx, y - dy / 2 - ny);
    ctx.lineTo(x + dx / 2 - nx * .25, y + dy / 2 - ny * .25);
    ctx.lineTo(x + dx / 2 + nx, y + dy / 2 + ny);
    ctx.lineTo(x - dx / 2 + nx * .25, y - dy / 2 + ny * .25);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.strokeStyle = `rgba(255, 225, 218, ${s.alpha * .62})`;
    ctx.lineWidth = .65;
    ctx.stroke();

    // A fine luminous edge gives the shards their cut-glass look.
    ctx.beginPath();
    ctx.moveTo(x - dx / 2 - nx * .5, y - dy / 2 - ny * .5);
    ctx.lineTo(x + dx / 2 - nx * .5, y + dy / 2 - ny * .5);
    ctx.strokeStyle = `rgba(255, 244, 226, ${s.alpha * .7})`;
    ctx.stroke();
  }

  function drawMarker(x, y, alpha, size) {
    ctx.strokeStyle = `rgba(255, 210, 202, ${alpha})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - size, y); ctx.lineTo(x + size, y);
    ctx.moveTo(x, y - size); ctx.lineTo(x, y + size);
    ctx.stroke();
    ctx.fillStyle = `rgba(255, 232, 221, ${alpha * .7})`;
    ctx.beginPath(); ctx.arc(x, y, 1.2, 0, Math.PI * 2); ctx.fill();
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (now - last < 30 && !reduceMotion) return;
    last = now;
    ctx.clearRect(0, 0, width, height);

    // Deep wine-colored atmospheric glow, deliberately subtle behind the rose.
    const glow = ctx.createRadialGradient(width * .5, height * .48, 4, width * .5, height * .48, Math.max(width, height) * .72);
    glow.addColorStop(0, "rgba(130, 28, 62, .20)");
    glow.addColorStop(.58, "rgba(79, 10, 39, .12)");
    glow.addColorStop(1, "rgba(28, 0, 15, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    pointer.x += (pointer.tx - pointer.x) * .035;
    pointer.y += (pointer.ty - pointer.y) * .035;

    for (const s of shards) {
      s.y -= s.speed * (reduceMotion ? 0 : 1);
      s.x += s.drift;
      if (s.y < -120) { s.y = height + 100; s.x = rand(0, width); }
      if (s.x < -140) s.x = width + 100;
      if (s.x > width + 140) s.x = -100;
      drawShard(s, now);
    }

    // Sparse survey-like plus markers, in warm champagne rather than neon.
    const markerCount = Math.max(8, Math.round(count * .22));
    for (let i = 0; i < markerCount; i++) {
      const x = ((i * 137.5 + now * .004) % (width + 30)) - 15;
      const y = ((i * 83.7 + Math.sin(now * .00025 + i) * 15) % (height + 30)) - 15;
      drawMarker(x, y, .16 + .12 * Math.sin(now * .001 + i), 2.5);
    }

    if (pulse > 0) {
      ctx.fillStyle = `rgba(255, 190, 195, ${pulse * .12})`;
      ctx.fillRect(0, 0, width, height);
      pulse *= .91;
      if (pulse < .01) pulse = 0;
    }
  }

  screen.addEventListener("pointermove", (event) => {
    const r = screen.getBoundingClientRect();
    pointer.tx = ((event.clientX - r.left) / r.width - .5) * 2;
    pointer.ty = ((event.clientY - r.top) / r.height - .5) * 2;
  }, { passive: true });

  screen.addEventListener("pointerleave", () => {
    pointer.tx = 0; pointer.ty = 0;
  }, { passive: true });

  // Small warm shimmer when the rose screen is tapped.
  screen.addEventListener("click", () => { pulse = 1; }, { passive: true });

  if ("ResizeObserver" in window) {
    new ResizeObserver(resize).observe(screen);
  } else {
    window.addEventListener("resize", resize, { passive: true });
  }

  resize();
  raf = requestAnimationFrame(frame);

  // Stop rendering when the intro is no longer visible to save battery.
  const observer = new MutationObserver(() => {
    if (getComputedStyle(screen).display === "none" || screen.hidden) {
      cancelAnimationFrame(raf);
    } else if (!raf) {
      last = 0;
      raf = requestAnimationFrame(frame);
    }
  });
  observer.observe(screen, { attributes: true, attributeFilter: ["class", "style", "hidden"] });
})();
