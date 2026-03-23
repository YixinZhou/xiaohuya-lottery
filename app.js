/**
 * 转盘抽奖核心逻辑
 * 扇区从正上方（12点）顺时针绘制；指针固定在正上方。
 */
(function () {
  const canvas = document.getElementById("wheel");
  const ctx    = canvas.getContext("2d");
  const spinBtn    = document.getElementById("spinBtn");
  const overlay    = document.getElementById("overlay");
  const prizeText  = document.getElementById("prizeText");
  const closeBtn   = document.getElementById("closeOverlay");

  const SEGMENTS = [
    { label: "谢谢惠顾",    deg: 100/3, fill: "#f8f8f8" },
    { label: "5元无门槛券",  deg: 80,   fill: "#ffd166" },
    { label: "香酥整鸭8.5折", deg: 55,  fill: "#f4845f" },
    { label: "谢谢惠顾",    deg: 100/3, fill: "#f8f8f8" },
    { label: "满100-25元", deg: 55,    fill: "#8ac926" },
    { label: "220礼包半价", deg: 45,    fill: "#74c0fc" },
    { label: "谢谢惠顾",    deg: 100/3, fill: "#f8f8f8" },
    { label: "150元免单券", deg: 25,    fill: "#da77f2" },
  ];

  const totalDeg = SEGMENTS.reduce((s, x) => s + x.deg, 0);
  if (Math.abs(totalDeg - 360) > 0.01) {
    console.warn("扇区角度之和:", totalDeg);
  }

  // 每个扇区的文字颜色
  const LABEL_COLORS = [
    "#999", "#fff", "#fff", "#999", "#fff", "#fff", "#999", "#fff",
  ];

  let rotationDeg = 0;
  let spinning    = false;

  function degToRad(d) { return (d * Math.PI) / 180; }

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
    const w   = canvas.width / dpr;
    const h   = canvas.height / dpr;
    const cx  = w / 2;
    const cy  = h / 2;
    const r   = Math.min(w, h) / 2 - 4;

    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(degToRad(rotationDeg));

    let start = -Math.PI / 2;

    SEGMENTS.forEach((seg, i) => {
      const sweep = degToRad(seg.deg);

      // 扇形填充
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, start, start + sweep);
      ctx.closePath();
      ctx.fillStyle = seg.fill;
      ctx.fill();

      // 白色分割线
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // 文字
      const mid     = start + sweep / 2;
      const label   = seg.label;
      const color   = LABEL_COLORS[i];
      const radius  = r * 0.66;

      ctx.save();
      ctx.rotate(mid);
      ctx.textAlign    = "right";
      ctx.textBaseline = "middle";
      ctx.fillStyle    = color;
      // 用较大字号，在小扇区自动裁切
      const maxW = r - 20;
      let fontSize = Math.min(13, r * 0.095);
      ctx.font = `700 ${fontSize}px "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif`;
      ctx.shadowColor   = "rgba(0,0,0,0.3)";
      ctx.shadowBlur    = 4;
      ctx.fillText(label, radius, 0);
      ctx.shadowBlur = 0;
      ctx.restore();

      start += sweep;
    });

    ctx.restore();

    // 中心圆装饰
    ctx.beginPath();
    ctx.arc(cx, cy, 20, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.strokeStyle = "rgba(230,57,70,0.8)";
    ctx.lineWidth = 3;
    ctx.stroke();

    // 中心文字
    ctx.fillStyle    = "#e63946";
    ctx.font         = `900 11px "Noto Sans SC", "PingFang SC", sans-serif`;
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("抽奖", cx, cy);
  }

  function wrapLabel(text, maxChars) {
    if (text.length <= maxChars) return [text];
    const out = [];
    for (let i = 0; i < text.length; i += maxChars) out.push(text.slice(i, i + maxChars));
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

  function targetRotationForIndex(index, extraSpins, startDeg) {
    const centers = segmentCenterAngles();
    const center  = centers[index];
    let need = ((-startDeg - center) % 360 + 360) % 360;
    if (need < 1) need = 360;
    return startDeg + need + 360 * extraSpins;
  }

  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  function easeOutQuart(t) { return 1 - Math.pow(1 - t, 4); }

  function spinToIndex(index) {
    const start  = rotationDeg;
    const extra  = 5 + Math.floor(Math.random() * 4);
    const end    = targetRotationForIndex(index, extra, start);
    const duration = 4500;
    const t0     = performance.now();

    function frame(now) {
      const t = Math.min(1, (now - t0) / duration);
      // 前半段 cubic，后半段 quart，做急起急停效果
      const e = t < 0.55
        ? easeOutCubic(t / 0.55) * 0.55
        : 0.55 + easeOutQuart((t - 0.55) / 0.45) * 0.45;
      rotationDeg = start + (end - start) * e;
      drawWheel();
      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        rotationDeg = end;
        drawWheel();
        spinning    = false;
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

  closeBtn.addEventListener("click", hideOverlay);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) hideOverlay();
  });

  // 高清画布适配
  function resizeCanvas() {
    const wrap = canvas.parentElement;
    const size = Math.min(wrap.clientWidth, wrap.clientHeight, 320);
    const dpr  = window.devicePixelRatio || 1;
    canvas.width  = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    canvas.style.width  = size + "px";
    canvas.style.height = size + "px";
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    drawWheel();
  }

  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();
})();
