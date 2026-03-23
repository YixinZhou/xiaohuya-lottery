/**
 * 环形转盘：中间镂空展示品牌 Logo；指针在正上方；扇区面积加权随机。
 */
(function () {
  const canvas = document.getElementById("wheel");
  const ctx = canvas.getContext("2d");
  const spinBtn = document.getElementById("spinBtn");
  const overlay = document.getElementById("overlay");
  const prizeText = document.getElementById("prizeText");
  const closeBtn = document.getElementById("closeOverlay");

  /**
   * 与 CSS `.wheel-hub` 一致：width 50%、max-width 170px → 半径 min(25% 边长, 85px)
   * 环形内缘须与该白圈对齐，不能用固定比例缩小内圆，否则白圈会盖住扇区文字。
   */
  function hubRadiusPx(w, h) {
    return Math.min(Math.min(w, h) * 0.25, 85);
  }

  /** 文字沿径向尽量靠外，且保证整行在中心 Logo 圆之外 */
  const TEXT_RATIO = 0.52;
  const TEXT_CLEAR_BEYOND_HUB = 26;

  const SEGMENTS = [
    { label: "谢谢惠顾", deg: 100 / 3, fill: "#FFF5F0", text: "#8B7355" },
    { label: "5元\n无门槛券", deg: 80, fill: "#FFD166", text: "#5c3d00" },
    { label: "香酥整鸭\n8.5折", deg: 55, fill: "#FF8A5B", text: "#fff" },
    { label: "谢谢惠顾", deg: 100 / 3, fill: "#FFF5F0", text: "#8B7355" },
    { label: "满100减25", deg: 55, fill: "#F25C19", text: "#fff" },
    { label: "220礼包半价", deg: 45, fill: "#FFB703", text: "#4a2e00" },
    { label: "谢谢惠顾", deg: 100 / 3, fill: "#FFF5F0", text: "#8B7355" },
    { label: "150元\n免单券", deg: 25, fill: "#E03131", text: "#fff" },
  ];

  let rotationDeg = 0;
  let spinning = false;

  function degToRad(d) {
    return (d * Math.PI) / 180;
  }

  function segmentCenterAngles() {
    let cursor = 0;
    return SEGMENTS.map((seg) => {
      const mid = cursor + seg.deg / 2;
      cursor += seg.deg;
      return mid;
    });
  }

  function drawWheel() {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const cx = w / 2;
    const cy = h / 2;
    const R = Math.min(w, h) / 2 - 10;
    const hubR = hubRadiusPx(w, h);
    const rInner = Math.min(Math.max(hubR - 2, 0), R - 14);

    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(degToRad(rotationDeg));

    let start = -Math.PI / 2;

    SEGMENTS.forEach((seg) => {
      const sweep = degToRad(seg.deg);
      ctx.beginPath();
      ctx.arc(0, 0, R, start, start + sweep);
      ctx.arc(0, 0, rInner, start + sweep, start, true);
      ctx.closePath();

      const g = ctx.createRadialGradient(0, 0, rInner, 0, 0, R);
      g.addColorStop(0, seg.fill);
      g.addColorStop(1, shadeColor(seg.fill, -12));
      ctx.fillStyle = g;
      ctx.fill();

      ctx.strokeStyle = "rgba(255,255,255,0.92)";
      ctx.lineWidth = 2;
      ctx.stroke();

      const mid = start + sweep / 2;
      const textR = Math.max(
        rInner + (R - rInner) * TEXT_RATIO,
        hubR + TEXT_CLEAR_BEYOND_HUB
      );
      ctx.save();
      ctx.rotate(mid);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const fontPx = Math.min(15, Math.round((R - rInner) * 0.15));
      ctx.font = `700 ${fontPx}px "Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif`;
      ctx.fillStyle = seg.text;
      ctx.shadowColor = "rgba(0,0,0,0.18)";
      ctx.shadowBlur = 3;
      const lines = wrapText(seg.label, 5);
      const lh = fontPx + 2;
      let ty = -((lines.length - 1) * lh) / 2;
      lines.forEach((line) => {
        ctx.fillText(line, textR, ty);
        ty += lh;
      });
      ctx.shadowBlur = 0;
      ctx.restore();

      start += sweep;
    });

    ctx.restore();

    ctx.beginPath();
    ctx.arc(cx, cy, rInner - 1.5, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(242, 92, 25, 0.45)";
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  function shadeColor(hex, percent) {
    const n = hex.replace("#", "");
    const num = parseInt(n, 16);
    let r = (num >> 16) & 255;
    let g = (num >> 8) & 255;
    let b = num & 255;
    r = Math.round(r * (1 + percent / 100));
    g = Math.round(g * (1 + percent / 100));
    b = Math.round(b * (1 + percent / 100));
    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));
    return `rgb(${r},${g},${b})`;
  }

  function wrapText(text, maxLen) {
    // 先按手动换行符拆分
    const manual = text.split("\n");
    const out = [];
    manual.forEach((chunk) => {
      if (chunk.length <= maxLen) {
        out.push(chunk);
      } else {
        for (let i = 0; i < chunk.length; i += maxLen) out.push(chunk.slice(i, i + maxLen));
      }
    });
    return out;
  }

  function weightedIndex() {
    const rnd = Math.random() * 360;
    let acc = 0;
    for (let i = 0; i < SEGMENTS.length; i++) {
      acc += SEGMENTS[i].deg;
      if (rnd < acc) return i;
    }
    return SEGMENTS.length - 1;
  }

  function targetRotationForIndex(index, extraSpins, startDeg) {
    const centers = segmentCenterAngles();
    const center = centers[index];
    let need = ((-startDeg - center) % 360 + 360) % 360;
    if (need === 0) need = 360;
    return startDeg + need + 360 * extraSpins;
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function easeOutExpo(t) {
    return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
  }

  function spinToIndex(index) {
    const start = rotationDeg;
    const extra = 1 + Math.floor(Math.random() * 2);
    const end = targetRotationForIndex(index, extra, start);
    const duration = 4000;
    const t0 = performance.now();

    function frame(now) {
      const t = Math.min(1, (now - t0) / duration);
      const e = easeOutExpo(t);
      rotationDeg = start + (end - start) * e;
      drawWheel();
      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        rotationDeg = end;
        drawWheel();
        spinning = false;
        spinBtn.disabled = false;
        showResult(SEGMENTS[index].label);
      }
    }
    requestAnimationFrame(frame);
  }

  function showResult(label) {
    prizeText.textContent = label;
    overlay.classList.remove("hidden");
    overlay.setAttribute("aria-hidden", "false");
  }

  function hideOverlay() {
    overlay.classList.add("hidden");
    overlay.setAttribute("aria-hidden", "true");
  }

  spinBtn.addEventListener("click", () => {
    if (spinning) return;
    spinning = true;
    spinBtn.disabled = true;
    spinToIndex(weightedIndex());
  });

  closeBtn.addEventListener("click", hideOverlay);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) hideOverlay();
  });

  function resizeCanvas() {
    const wrap = canvas.parentElement;
    const size = Math.min(wrap.clientWidth, wrap.clientHeight, 360);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    drawWheel();
  }

  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();
})();
