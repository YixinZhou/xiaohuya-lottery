/**
 * 转盘：从正上方（12 点）起顺时针绘制；指针固定在正上方，中奖区域为指针所指扇形。
 * 各扇区角度与业务「面积」一致，抽奖按角度加权随机。
 */
(function () {
  const canvas = document.getElementById("wheel");
  const ctx = canvas.getContext("2d");
  const spinBtn = document.getElementById("spinBtn");
  const overlay = document.getElementById("overlay");
  const prizeText = document.getElementById("prizeText");
  const closeOverlay = document.getElementById("closeOverlay");

  /** @type {{ label: string; deg: number; fill: string }[]} */
  const SEGMENTS = [
    { label: "谢谢惠顾", deg: 100 / 3, fill: "#e8e4dc" },
    { label: "5元无门槛券", deg: 80, fill: "#ffd54f" },
    { label: "香酥整鸭8.5折券", deg: 55, fill: "#ffab91" },
    { label: "谢谢惠顾", deg: 100 / 3, fill: "#e8e4dc" },
    { label: "满100元-25元", deg: 55, fill: "#a5d6a7" },
    { label: "220元礼包半价券", deg: 45, fill: "#90caf9" },
    { label: "谢谢惠顾", deg: 100 / 3, fill: "#e8e4dc" },
    { label: "150元内免单券", deg: 25, fill: "#ce93d8" },
  ];

  const totalDeg = SEGMENTS.reduce((s, x) => s + x.deg, 0);
  if (Math.abs(totalDeg - 360) > 0.001) {
    console.warn("扇区角度之和应为 360°，当前:", totalDeg);
  }

  let rotationDeg = 0;
  let spinning = false;

  function degToRad(d) {
    return (d * Math.PI) / 180;
  }

  /** 扇区中心在「未旋转画布」上相对正上方的顺时针角度（度） */
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
    const r = Math.min(w, h) / 2 - 8;

    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(degToRad(rotationDeg));

    let start = -Math.PI / 2;
    SEGMENTS.forEach((seg) => {
      const sweep = degToRad(seg.deg);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, start, start + sweep);
      ctx.closePath();
      ctx.fillStyle = seg.fill;
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();

      const mid = start + sweep / 2;
      ctx.save();
      ctx.rotate(mid);
      ctx.textAlign = "right";
      ctx.fillStyle = "#2b1810";
      ctx.font = "bold 13px PingFang SC, Microsoft YaHei, sans-serif";
      const lines = wrapLabel(seg.label, 6);
      const lineHeight = 15;
      let ty = -((lines.length - 1) * lineHeight) / 2;
      lines.forEach((line) => {
        ctx.fillText(line, r - 14, ty);
        ty += lineHeight;
      });
      ctx.restore();

      start += sweep;
    });

    ctx.restore();

    ctx.beginPath();
    ctx.arc(cx, cy, 22, 0, Math.PI * 2);
    ctx.fillStyle = "#c41e3a";
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 11px PingFang SC, Microsoft YaHei, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("抽奖", cx, cy);
  }

  function wrapLabel(text, maxChars) {
    if (text.length <= maxChars) return [text];
    const out = [];
    let i = 0;
    while (i < text.length) {
      out.push(text.slice(i, i + maxChars));
      i += maxChars;
    }
    return out;
  }

  function weightedIndex() {
    const r = Math.random() * 360;
    let acc = 0;
    for (let i = 0; i < SEGMENTS.length; i++) {
      acc += SEGMENTS[i].deg;
      if (r < acc) return i;
    }
    return SEGMENTS.length - 1;
  }

  /**
   * 在 rotationDeg 连续累加的前提下，计算终点角度，保证多转 extraSpins 圈以上且指针落在该扇区中心。
   * 条件：(center + end) % 360 === 0。
   */
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

  function spinToIndex(index) {
    const start = rotationDeg;
    const extra = 5 + Math.floor(Math.random() * 3);
    const end = targetRotationForIndex(index, extra, start);
    const duration = 4200;
    const t0 = performance.now();

    function frame(now) {
      const t = Math.min(1, (now - t0) / duration);
      const e = easeOutCubic(t);
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
    const idx = weightedIndex();
    spinToIndex(idx);
  });

  closeOverlay.addEventListener("click", hideOverlay);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) hideOverlay();
  });

  function resizeCanvas() {
    const wrap = canvas.parentElement;
    const size = Math.min(wrap.clientWidth, wrap.clientHeight, 360);
    const dpr = window.devicePixelRatio || 1;
    const px = Math.round(size * dpr);
    canvas.width = px;
    canvas.height = px;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    drawWheel();
  }

  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();
})();
