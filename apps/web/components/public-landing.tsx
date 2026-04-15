"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useUiText } from "./site-language-provider";

const proofStats = [
  { value: "3x", label: "daha hızlı shortlist", detail: "CV tarama, uyum sinyalleri ve önceliklendirme tek akışta." },
  { value: "%87", label: "daha net operasyon görünürlüğü", detail: "Başvuru, görüşme ve karar adımları aynı ekranda toplanır." },
  { value: "24/7", label: "kesintisiz aday ön görüşmesi", detail: "Sesli veya yazı tabanlı tarama vardiya saatlerini beklemez." }
] as const;

const workflowSteps = [
  {
    step: "01",
    title: "Başvuruyu topla",
    body: "Inbound adayları, kanalları ve pozisyon bazlı hareketi tek akışta topla."
  },
  {
    step: "02",
    title: "AI ile tarama yap",
    body: "CV içeriğini, deneyim derinliğini ve rol uyumunu anında açığa çıkar."
  },
  {
    step: "03",
    title: "Ön görüşmeyi otomatize et",
    body: "Türkçe sesli ya da yazılı görüşmelerle aday fit sinyallerini standartlaştır."
  },
  {
    step: "04",
    title: "Takvime bağla",
    body: "Yüksek potansiyelli adayları görüşmeye giden hızlı bir akışa taşır."
  }
] as const;

const surfaceCards = [
  {
    eyebrow: "Operasyon paneli",
    title: "Aday akışını sadece görmezsin, hızlandırırsın.",
    body: "hireEZ'deki hero videosunun verdiği ürün hissini burada animasyonlu bir workflow sahnesine çevirdik: başvuru, tarama, görüşme ve randevu tek bir premium hero içinde akıyor."
  },
  {
    eyebrow: "AI destekli ön eleme",
    title: "Anahtar kelime eşleşmesinden fazlası.",
    body: "Rol uyumu, deneyim bağlamı, fraud sinyalleri ve görüşme özeti aynı karar zemininde buluşuyor."
  }
] as const;

function MarketingHeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    const container = canvas.parentElement;

    if (!context || !container) {
      return;
    }

    const drawingCanvas = canvas;
    const ctx = context;
    const host = container;

    const particles = Array.from({ length: 30 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 3 + 1,
      speed: Math.random() * 0.0018 + 0.0007,
      opacity: Math.random() * 0.16 + 0.05
    }));

    let width = 0;
    let height = 0;
    let deviceRatio = 1;
    let frameId = 0;
    let startedAt = 0;
    let reduceMotion = false;
    let sansFont = '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    function clamp01(value: number) {
      return Math.max(0, Math.min(1, value));
    }

    function easeOutCubic(value: number) {
      return 1 - Math.pow(1 - value, 3);
    }

    function easeInOutCubic(value: number) {
      return value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
    }

    function easeOutBack(value: number) {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(value - 1, 3) + c1 * Math.pow(value - 1, 2);
    }

    function lerp(start: number, end: number, amount: number) {
      return start + (end - start) * amount;
    }

    function syncSansFont() {
      const rootFont = getComputedStyle(document.documentElement).getPropertyValue("--font-sans").trim();
      const bodyFont = getComputedStyle(document.body).fontFamily.trim();
      sansFont = rootFont || bodyFont || sansFont;
    }

    function roundRect(x: number, y: number, w: number, h: number, radius: number) {
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + w - radius, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
      ctx.lineTo(x + w, y + h - radius);
      ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
      ctx.lineTo(x + radius, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
    }

    function makeGradient(stops: Array<readonly [number, string]>) {
      const gradient = ctx.createLinearGradient(width * 0.12, 0, width * 0.88, height);
      stops.forEach(([offset, color]) => gradient.addColorStop(offset, color));
      return gradient;
    }

    function drawParticles() {
      particles.forEach((particle) => {
        particle.y -= particle.speed;
        if (particle.y < -0.04) {
          particle.y = 1.04;
          particle.x = Math.random();
        }

        ctx.beginPath();
        ctx.arc(particle.x * width, particle.y * height, particle.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(121, 241, 217, ${particle.opacity})`;
        ctx.fill();
      });
    }

    function drawCursor(x: number, y: number, clicking: boolean) {
      ctx.save();
      ctx.translate(x, y);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, 18);
      ctx.lineTo(5, 14);
      ctx.lineTo(9, 22);
      ctx.lineTo(12, 20);
      ctx.lineTo(8, 12);
      ctx.lineTo(14, 12);
      ctx.closePath();
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.strokeStyle = "rgba(0, 0, 0, 0.28)";
      ctx.lineWidth = 1;
      ctx.stroke();

      if (clicking) {
        ctx.beginPath();
        ctx.arc(4, 8, 14, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(249, 115, 90, 0.4)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.restore();
    }

    function drawFrame(seconds: number) {
      const timeline = reduceMotion ? 8.4 : seconds % 11.8;

      ctx.clearRect(0, 0, width, height);

      const backdrop = ctx.createLinearGradient(0, 0, width, height);
      backdrop.addColorStop(0, "#071019");
      backdrop.addColorStop(0.56, "#0c1a25");
      backdrop.addColorStop(1, "#09121a");
      ctx.fillStyle = backdrop;
      ctx.fillRect(0, 0, width, height);

      const bloomLeft = ctx.createRadialGradient(width * 0.26, height * 0.3, 0, width * 0.26, height * 0.3, width * 0.42);
      bloomLeft.addColorStop(0, "rgba(249, 115, 90, 0.18)");
      bloomLeft.addColorStop(1, "rgba(249, 115, 90, 0)");
      ctx.fillStyle = bloomLeft;
      ctx.fillRect(0, 0, width, height);

      const bloomRight = ctx.createRadialGradient(width * 0.74, height * 0.68, 0, width * 0.74, height * 0.68, width * 0.44);
      bloomRight.addColorStop(0, "rgba(121, 241, 217, 0.16)");
      bloomRight.addColorStop(1, "rgba(121, 241, 217, 0)");
      ctx.fillStyle = bloomRight;
      ctx.fillRect(0, 0, width, height);

      drawParticles();

      if (timeline < 3.4) {
        const fadeIn = clamp01(timeline / 0.8);
        const scale = lerp(0.72, 1, easeOutCubic(clamp01(timeline / 1.2)));
        const fadeOut = timeline > 2.45 ? 1 - clamp01((timeline - 2.45) / 0.8) : 1;
        const scaleOut =
          timeline > 2.45 ? lerp(1, 1.14, easeInOutCubic(clamp01((timeline - 2.45) / 0.8))) : scale;

        ctx.save();
        ctx.globalAlpha = fadeIn * fadeOut;
        ctx.translate(width / 2, height / 2);
        ctx.scale(scaleOut, scaleOut);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `800 ${Math.min(width * 0.11, 90)}px ${sansFont}`;
        ctx.fillStyle = makeGradient([
          [0, "#ffb38d"],
          [0.34, "#ff7d67"],
          [0.7, "#6de7d6"],
          [1, "#97d3ff"]
        ]);
        ctx.fillText("aday", 0, -Math.min(width * 0.11, 90) * 0.5);
        ctx.fillText("akışı", 0, Math.min(width * 0.11, 90) * 0.54);
        ctx.restore();
      }

      if (timeline > 2.2 && timeline < 5.9) {
        const sceneTime = timeline - 2.2;
        const fadeIn = clamp01(sceneTime / 0.45);
        const fadeOut = sceneTime > 3.1 ? 1 - clamp01((sceneTime - 3.1) / 0.7) : 1;
        const features = [
          { label: "Başvuru havuzu", tint: "#ff9068", delay: 0 },
          { label: "Rol uyum sinyali", tint: "#72d7ff", delay: 0.16 },
          { label: "Sesli ön görüşme", tint: "#79f1d9", delay: 0.32 },
          { label: "Takvim eşleme", tint: "#f6c56a", delay: 0.48 }
        ];

        ctx.save();
        ctx.globalAlpha = fadeIn * fadeOut;

        features.forEach((feature, index) => {
          const progress = clamp01((sceneTime - feature.delay) / 0.48);
          const startX = index % 2 === 0 ? -240 : width + 240;
          const targetX = width * 0.16 + index * (width * 0.18);
          const y = height * 0.3 + index * 56;
          const x = lerp(startX, targetX, easeOutBack(progress));

          ctx.globalAlpha = fadeIn * fadeOut * progress;
          roundRect(x, y, 220, 42, 12);
          ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
          ctx.fill();
          ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
          ctx.lineWidth = 1;
          ctx.stroke();

          roundRect(x + 10, y + 9, 24, 24, 8);
          ctx.fillStyle = `${feature.tint}22`;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(x + 22, y + 21, 5, 0, Math.PI * 2);
          ctx.fillStyle = feature.tint;
          ctx.fill();

          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.font = `600 13px ${sansFont}`;
          ctx.fillStyle = "#eff7ff";
          ctx.fillText(feature.label, x + 44, y + 21);
        });

        ctx.restore();
      }

      if (timeline > 4.8) {
        const sceneTime = timeline - 4.8;
        const fadeIn = clamp01(sceneTime / 0.55);
        const cardExit = sceneTime > 5 ? 1 - clamp01((sceneTime - 5) / 0.8) : 1;

        ctx.save();
        ctx.globalAlpha = fadeIn * cardExit;

        const frameX = 34;
        const frameY = 32;
        const frameW = width - 68;
        const frameH = height - 64;

        roundRect(frameX, frameY, frameW, frameH, 24);
        ctx.fillStyle = "rgba(4, 12, 18, 0.62)";
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
        ctx.lineWidth = 1;
        ctx.stroke();

        roundRect(frameX + 18, frameY + 18, 120, 28, 14);
        ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
        ctx.fill();
        ctx.fillStyle = "#8ba5b7";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `600 11px ${sansFont}`;
        ctx.fillText("Candit Pipeline", frameX + 78, frameY + 32);

        const kpis = [
          { label: "Başvuru", value: "642", color: "#ff8d70" },
          { label: "Skorlandı", value: "214", color: "#6de7d6" },
          { label: "Ön görüşme", value: "81", color: "#72d7ff" },
          { label: "Takvim", value: "17", color: "#f6c56a" }
        ];

        const gap = 10;
        const cardWidth = (frameW - 36 - gap * 3) / 4;
        kpis.forEach((kpi, index) => {
          const progress = clamp01((sceneTime - index * 0.12) / 0.4);
          const yOffset = lerp(28, 0, easeOutCubic(progress));
          const x = frameX + 18 + index * (cardWidth + gap);
          const y = frameY + 64 + yOffset;

          ctx.globalAlpha = fadeIn * cardExit * progress;
          roundRect(x, y, cardWidth, 72, 16);
          ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
          ctx.fill();
          ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
          ctx.stroke();

          ctx.fillStyle = "#7d96a8";
          ctx.textAlign = "left";
          ctx.font = `500 10px ${sansFont}`;
          ctx.fillText(kpi.label.toUpperCase(), x + 14, y + 22);

          ctx.fillStyle = kpi.color;
          ctx.font = `700 26px ${sansFont}`;
          ctx.fillText(kpi.value, x + 14, y + 50);
        });

        const rows = [
          { name: "Ayşe Kurt", role: "Depo Operasyon", status: "Uyum skoru hazır", statusColor: "#6de7d6", score: "94%" },
          { name: "Mert Akar", role: "Mağaza Vardiya", status: "Sesli ön görüşme", statusColor: "#72d7ff", score: "88%" },
          { name: "Seda Gönül", role: "Müşteri Destek", status: "Takvime taşındı", statusColor: "#f6c56a", score: "81%" }
        ];

        const tableTop = frameY + 162;
        ctx.globalAlpha = fadeIn * cardExit * clamp01((sceneTime - 0.58) / 0.32);
        ctx.fillStyle = "#69849a";
        ctx.font = `600 10px ${sansFont}`;
        ["Aday", "Rol", "Durum", "Skor"].forEach((title, index) => {
          const columnX = frameX + 22 + index * ((frameW - 44) / 4);
          ctx.textAlign = index === 3 ? "right" : "left";
          ctx.fillText(title.toUpperCase(), index === 3 ? frameX + frameW - 22 : columnX, tableTop);
        });

        rows.forEach((row, index) => {
          const progress = clamp01((sceneTime - 0.86 - index * 0.18) / 0.36);
          const xOffset = lerp(42, 0, easeOutCubic(progress));
          const rowY = tableTop + 34 + index * 42;

          ctx.globalAlpha = fadeIn * cardExit * progress;
          ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
          ctx.beginPath();
          ctx.moveTo(frameX + 18, rowY + 18);
          ctx.lineTo(frameX + frameW - 18, rowY + 18);
          ctx.stroke();

          ctx.textAlign = "left";
          ctx.fillStyle = "#f4f8fb";
          ctx.font = `600 13px ${sansFont}`;
          ctx.fillText(row.name, frameX + 22 + xOffset, rowY);

          ctx.fillStyle = "#8aa2b3";
          ctx.font = `500 12px ${sansFont}`;
          ctx.fillText(row.role, frameX + 22 + (frameW - 44) / 4 + xOffset * 0.55, rowY);

          const statusX = frameX + 22 + ((frameW - 44) / 4) * 2 + xOffset * 0.28;
          ctx.beginPath();
          ctx.arc(statusX, rowY - 3, 4, 0, Math.PI * 2);
          ctx.fillStyle = row.statusColor;
          ctx.fill();
          ctx.fillStyle = row.statusColor;
          ctx.fillText(row.status, statusX + 12, rowY);

          ctx.textAlign = "right";
          ctx.font = `700 13px ${sansFont}`;
          ctx.fillText(row.score, frameX + frameW - 24, rowY);
        });

        if (sceneTime > 1.5 && sceneTime < 4.2) {
          const cursorProgress = clamp01((sceneTime - 1.5) / 2.1);
          const cursorX = lerp(frameX + frameW * 0.18, frameX + frameW * 0.66, easeInOutCubic(cursorProgress));
          const cursorY = lerp(frameY + 136, tableTop + 29, easeInOutCubic(cursorProgress));
          const clicking = cursorProgress > 0.52 && cursorProgress < 0.62;
          ctx.globalAlpha = fadeIn * cardExit;
          drawCursor(cursorX, cursorY, clicking);
        }

        ctx.restore();
      }

      if (timeline > 9.4) {
        const sceneTime = timeline - 9.4;
        const fadeIn = clamp01(sceneTime / 0.5);
        const fadeOut = sceneTime > 1.4 ? 1 - clamp01((sceneTime - 1.4) / 0.45) : 1;

        ctx.save();
        ctx.globalAlpha = fadeIn * fadeOut;
        ctx.translate(width / 2, height / 2);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `700 ${Math.min(width * 0.04, 32)}px ${sansFont}`;
        ctx.fillStyle = makeGradient([
          [0, "#ffb38d"],
          [0.3, "#ff7d67"],
          [0.72, "#6de7d6"],
          [1, "#97d3ff"]
        ]);
        ctx.fillText("Başvurudan görüşmeye uzanan", 0, -18);
        ctx.fillText("tek ekranlık AI recruiter workflow'u", 0, 18);
        ctx.restore();
      }

      const vignette = ctx.createLinearGradient(0, 0, 0, height);
      vignette.addColorStop(0, "rgba(255, 255, 255, 0.08)");
      vignette.addColorStop(0.08, "rgba(255, 255, 255, 0)");
      vignette.addColorStop(0.92, "rgba(0, 0, 0, 0)");
      vignette.addColorStop(1, "rgba(0, 0, 0, 0.16)");
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, width, height);
    }

    function resize() {
      syncSansFont();
      const rect = host.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      deviceRatio = window.devicePixelRatio || 1;

      drawingCanvas.width = Math.floor(width * deviceRatio);
      drawingCanvas.height = Math.floor(height * deviceRatio);
      drawingCanvas.style.width = `${width}px`;
      drawingCanvas.style.height = `${height}px`;
      ctx.setTransform(deviceRatio, 0, 0, deviceRatio, 0, 0);
      drawFrame(0);
    }

    function loop(timestamp: number) {
      if (!startedAt) {
        startedAt = timestamp;
      }

      drawFrame((timestamp - startedAt) / 1000);
      frameId = window.requestAnimationFrame(loop);
    }

    function syncMotionPreference() {
      reduceMotion = prefersReducedMotion.matches;
      if (reduceMotion) {
        window.cancelAnimationFrame(frameId);
        startedAt = 0;
        drawFrame(8.4);
      } else {
        window.cancelAnimationFrame(frameId);
        startedAt = 0;
        frameId = window.requestAnimationFrame(loop);
      }
    }

    resize();

    const resizeObserver =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => resize()) : null;
    resizeObserver?.observe(host);
    window.addEventListener("resize", resize);
    prefersReducedMotion.addEventListener("change", syncMotionPreference);

    syncMotionPreference();

    if ("fonts" in document) {
      void document.fonts.ready.then(() => {
        syncSansFont();
      });
    }

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", resize);
      prefersReducedMotion.removeEventListener("change", syncMotionPreference);
    };
  }, []);

  return (
    <div className="marketing-stage-screen">
      <div className="marketing-stage-overlay" aria-hidden="true" />
      <canvas ref={canvasRef} className="marketing-stage-canvas" aria-hidden="true" />
    </div>
  );
}

export function PublicLanding() {
  const { t } = useUiText();
  return (
    <main className="marketing-page">
      <div className="marketing-glow marketing-glow-left" aria-hidden="true" />
      <div className="marketing-glow marketing-glow-right" aria-hidden="true" />

      <header className="marketing-nav-shell">
        <div className="marketing-shell marketing-nav">
          <Link href="/landing" className="marketing-brand" aria-label="Candit.ai landing sayfa">
            <span className="marketing-brand-mark">
              <img src="/brand/candit-mark.svg" alt="" aria-hidden="true" width="42" height="42" />
            </span>
            <span className="marketing-brand-copy">
              <strong>Candit.ai</strong>
              <span>AI Recruiter</span>
            </span>
          </Link>

          <nav className="marketing-nav-links" aria-label={t("Bölümler")}>
            <a href="#workflow">{t("Workflow")}</a>
            <a href="#impact">{t("Etkisi")}</a>
            <a href="#cta">{t("Başlayın")}</a>
          </nav>

          <div className="marketing-nav-actions">
            <Link href="/auth/login" className="marketing-nav-link">
              Giriş yap
            </Link>
            <Link href="/auth/signup" className="marketing-nav-button">
              Hesap oluştur
            </Link>
          </div>
        </div>
      </header>

      <section className="marketing-hero">
        <div className="marketing-shell marketing-hero-grid">
          <div className="marketing-copy">
            <span className="marketing-eyebrow">From application to interview, automated.</span>
            <h1>
              hireEZ’deki hero hissini alan,
              <span> size özel bir AI recruiter sahnesi.</span>
            </h1>
            <p className="marketing-copy-body">
              Başvuru toplama, CV tarama, aday fit sinyalleri, sesli ön görüşme ve takvimleme
              akışını tek bir premium hero içinde canlandırdım. Gerçek video asset bağımlılığı
              olmadan, ürün videosu hissi veren bir canvas animasyonu çalışıyor.
            </p>

            <div className="marketing-hero-actions">
              <Link href="/auth/signup" className="marketing-primary-link">
                Hesap oluştur
              </Link>
              <a href="#workflow" className="marketing-secondary-link">
                Akışı incele
              </a>
            </div>

            <div className="marketing-signal-row">
              <span>Kanıt bağlantılı tarama</span>
              <span>Türkçe AI ön görüşme</span>
              <span>Takvim ve recruiter operasyonu</span>
            </div>
          </div>

          <div className="marketing-stage-card">
            <div className="marketing-stage-topline">
              <span className="marketing-stage-kicker">See the workflow</span>
              <span className="marketing-stage-label">Hero motion concept</span>
            </div>
            <MarketingHeroCanvas />
            <div className="marketing-stage-footer">
              {workflowSteps.map((item) => (
                <div key={item.step} className="marketing-stage-pill">
                  <span>{item.step}</span>
                  <strong>{item.title}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="marketing-proof" id="impact">
        <div className="marketing-shell marketing-proof-grid">
          {proofStats.map((stat) => (
            <article key={stat.label} className="marketing-proof-card">
              <p className="marketing-proof-value">{stat.value}</p>
              <h2>{stat.label}</h2>
              <p>{stat.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-workflow" id="workflow">
        <div className="marketing-shell marketing-workflow-grid">
          <div className="marketing-workflow-copy">
            <span className="marketing-section-kicker">Hero architecture</span>
            <h2>Video gibi akan ama koddan üreyen bir recruiter workflow hero.</h2>
            <p>
              hireEZ referansındaki mantığı birebir kopyalamadan taşıdım: ürün anlatan hareketli bir
              sahne, hızlı metin blokları ve sistemin hangi adımlarda değer ürettiğini gösteren net
              aşamalar.
            </p>
          </div>

          <div className="marketing-workflow-list">
            {workflowSteps.map((item) => (
              <article key={item.step} className="marketing-step-card">
                <span>{item.step}</span>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="marketing-surface">
        <div className="marketing-shell marketing-surface-grid">
          {surfaceCards.map((card) => (
            <article key={card.title} className="marketing-surface-card">
              <span className="marketing-section-kicker">{card.eyebrow}</span>
              <h2>{card.title}</h2>
              <p>{card.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-cta" id="cta">
        <div className="marketing-shell">
          <div className="marketing-cta-panel">
            <span className="marketing-section-kicker">Ready to launch</span>
            <h2>Bu hero artık ana deneyimin bir parçası olarak çalışıyor.</h2>
            <p>
              Bu hero artık `"/landing"` üzerinden her zaman erişilebilir. Oturumu olmayan
              kullanıcılar `"/"` üzerinde de bu landing'i görür, oturumu olan recruiter
              kullanıcılar ise mevcut dashboard akışına devam eder.
            </p>
            <div className="marketing-hero-actions">
              <Link href="/auth/signup" className="marketing-primary-link">
                Ücretsiz başla
              </Link>
              <Link href="/auth/login" className="marketing-secondary-link">
                Mevcut hesaba gir
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
