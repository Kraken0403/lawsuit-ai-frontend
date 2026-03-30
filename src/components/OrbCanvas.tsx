import { useEffect, useRef } from "react";

export default function OrbCanvas({ size = 120 }: { size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = canvas.clientWidth;
    let h = canvas.clientHeight;
    const dpr = Math.max(1, window.devicePixelRatio || 1);

    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);

    const center = { x: w / 2, y: h / 2 };

    type Particle = {
      angle: number;
      dist: number;
      speed: number;
      size: number;
      ox: number;
      oy: number;
    };

    const particles: Particle[] = [];
    const COUNT = 50;
    for (let i = 0; i < COUNT; i++) {
      const angle = (i / COUNT) * Math.PI * 2;
      const dist = 28 + Math.random() * 36;
      particles.push({
        angle,
        dist,
        speed: 0.002 + Math.random() * 0.006,
        size: 1 + Math.random() * 3,
        ox: 0,
        oy: 0,
      });
    }

    let t = 0;
    const mouse = { x: center.x, y: center.y, active: false };

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
      mouse.active = true;
    };

    const onLeave = () => {
      mouse.active = false;
    };

    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);

    const draw = () => {
      if (!ctx) return;
      t += 1;
      // subtle trail
      ctx.clearRect(0, 0, w, h);

      // draw glow (blue-centric, avoid pure white)
      const grad = ctx.createRadialGradient(center.x, center.y - 6, 8, center.x, center.y, 80);
      grad.addColorStop(0, "rgba(180,210,255,0.10)");
      grad.addColorStop(0.3, "rgba(10,60,130,0.18)");
      grad.addColorStop(1, "rgba(6,47,82,0.06)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(center.x, center.y, 64, 0, Math.PI * 2);
      ctx.fill();

      // center core (purely blue tones, no white)
      ctx.beginPath();
      const coreGrad = ctx.createRadialGradient(center.x, center.y, 4, center.x, center.y, 48);
      coreGrad.addColorStop(0, "rgba(200,225,255,0.98)");
      coreGrad.addColorStop(0.25, "rgba(120,150,220,0.92)");
      coreGrad.addColorStop(1, "rgba(6,47,82,0.92)");
      ctx.fillStyle = coreGrad;
      ctx.arc(center.x, center.y, 40 + Math.sin(t * 0.02) * 2, 0, Math.PI * 2);
      ctx.fill();

      // particles
      particles.forEach((p, i) => {
        p.angle += p.speed;
        const wobble = Math.sin(t * 0.01 + i) * 4;
        const x = center.x + Math.cos(p.angle) * (p.dist + wobble) + p.ox;
        const y = center.y + Math.sin(p.angle) * (p.dist + wobble) + p.oy;

        // interaction
        if (mouse.active) {
          const dx = mouse.x - x;
          const dy = mouse.y - y;
          const dd = Math.sqrt(dx * dx + dy * dy);
          if (dd < 80) {
            const f = (80 - dd) / 80;
            p.ox -= (dx / dd) * f * 2;
            p.oy -= (dy / dd) * f * 2;
          } else {
            p.ox *= 0.96;
            p.oy *= 0.96;
          }
        } else {
          p.ox *= 0.92;
          p.oy *= 0.92;
        }

        const alpha = 0.55 + Math.abs(Math.sin(t * 0.01 + i)) * 0.45;
        ctx.beginPath();
        ctx.fillStyle = `rgba(255,255,255,${0.7 * alpha})`;
        ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fill();

        // slight colored outer
        ctx.beginPath();
        ctx.strokeStyle = `rgba(17,76,141,${0.06 * alpha})`;
        ctx.lineWidth = 1;
        ctx.arc(x, y, p.size + 2, 0, Math.PI * 2);
        ctx.stroke();
      });

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <div style={{ width: size, height: size }} className="orb-wrapper">
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block", borderRadius: 9999 }} />
    </div>
  );
}
