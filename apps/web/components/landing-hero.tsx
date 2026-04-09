"use client";

import { useEffect, useRef, useMemo } from "react";
import { useUiText } from "./site-language-provider";
import "./landing-hero.css";

export function LandingHero() {
  const { t } = useUiText();
  const pageRef = useRef<HTMLDivElement>(null);
  const chatDemoStarted = useRef(false);
  const chatLoopTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Manifesto: split text into words, mark emphasis ── */
  const manifestoWords = useMemo(() => {
    const text = t("Her gün yüzlerce CV inceleniyor ama doğru adayı bulmak imkansız hissettiriyor. Candit bunu değiştiriyor.");
    return text.split(/\s+/).map((word) => ({
      word,
      em: word.toLowerCase() === "candit",
    }));
  }, [t]);

  const chatMessages = useMemo(() => [
    { type: "bot", text: t("Selen Hanım, son deneyiminizden bahseder misiniz? Hangi teknolojilerle çalıştınız?") },
    { type: "candidate", text: t("Son 2 yıldır React ve TypeScript ile e-ticaret projeleri geliştiriyorum. Performans optimizasyonu ve CI/CD süreçlerinde aktif rol aldım.") },
    { type: "bot", text: t("Bir projede beklenmedik bir teknik sorunla karşılaştığınızda nasıl bir yol izlediniz?") },
    { type: "candidate", text: t("Canlıda kritik bir bellek sızıntısı yaşadık. Profiler ile root cause'u bulup, memo ve lazy loading ile çözdüm. Sayfa yüklenme süresi %40 düştü.") },
  ], [t]);

  useEffect(() => {
    const root = pageRef.current;
    if (!root) return;

    const cleanups: (() => void)[] = [];

    // 1. Hero scroll-driven text
    {
      const lines = root.querySelectorAll(".lp-hero-line");
      const tagline = root.querySelector(".lp-hero-tagline");
      const heroBottom = root.querySelector(".lp-hero-bottom");
      let ticking = false;
      let revealed = false;

      function updateHero() {
        const scrolled = window.scrollY;
        const thresholds = [0, 100, 200];
        for (let i = 0; i < lines.length; i++) {
          const line = lines.item(i);
          if (!line) {
            continue;
          }

          line.classList.toggle("lp-active", scrolled >= (thresholds[i] ?? 0));
        }
        if (scrolled >= 300) {
          tagline?.classList.add("lp-active");
          if (!revealed) { revealed = true; heroBottom?.classList.add("lp-visible"); }
        } else if (scrolled < 260) {
          tagline?.classList.remove("lp-active");
          if (revealed) { revealed = false; heroBottom?.classList.remove("lp-visible"); }
        }
        ticking = false;
      }

      const heroScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(updateHero); } };
      window.addEventListener("scroll", heroScroll, { passive: true });
      updateHero();
      cleanups.push(() => window.removeEventListener("scroll", heroScroll));
    }

    // 2. Word-by-word manifesto reveal
    {
      const section = root.querySelector(".lp-manifesto");
      const words = root.querySelectorAll(".lp-mw");
      if (section && words.length) {
        let ticking = false;

        function updateManifesto() {
          const rect = section!.getBoundingClientRect();
          const viewH = window.innerHeight;
          const start = viewH * 0.55;
          const end = -rect.height * 0.3;
          const progress = Math.max(0, Math.min(1, (start - rect.top) / (start - end)));
          const total = words.length;
          for (let i = 0; i < total; i++) {
            const threshold = (i + 1) / (total + 1);
            const word = words.item(i);
            if (!word) {
              continue;
            }

            word.classList.toggle("lp-lit", progress >= threshold);
          }
          ticking = false;
        }

        const manifestoScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(updateManifesto); } };
        window.addEventListener("scroll", manifestoScroll, { passive: true });
        updateManifesto();
        cleanups.push(() => window.removeEventListener("scroll", manifestoScroll));
      }
    }

    // 3. Scroll reveal (bidirectional)
    {
      const all = root.querySelectorAll(".lp-reveal, .lp-reveal-left, .lp-reveal-right, .lp-reveal-scale");

      const observer = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          e.isIntersecting ? e.target.classList.add("lp-visible") : e.target.classList.remove("lp-visible");
        });
      }, { threshold: 0.15, rootMargin: "0px 0px -90px 0px" });

      const lateObserver = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          e.isIntersecting ? e.target.classList.add("lp-visible") : e.target.classList.remove("lp-visible");
        });
      }, { threshold: 0.15, rootMargin: "0px 0px -170px 0px" });

      const chatSyncObserver = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          e.isIntersecting ? e.target.classList.add("lp-visible") : e.target.classList.remove("lp-visible");
        });
      }, { threshold: 0.15, rootMargin: "0px 0px -220px 0px" });

      all.forEach((el) => {
        if (el.classList.contains("lp-reveal-late")) {
          lateObserver.observe(el);
        } else {
          observer.observe(el);
        }
      });

      const chatGrid = root.querySelector("#chatDemoGrid");
      if (chatGrid) chatSyncObserver.observe(chatGrid);

      cleanups.push(() => {
        observer.disconnect();
        lateObserver.disconnect();
        chatSyncObserver.disconnect();
      });
    }

    // 3b. Scroll-driven staggered cards
    {
      const grids = [
        { id: "channelsGrid", start: 110, gap: 80 },
        { id: "proofGrid", start: 110, gap: 80 },
        { id: "stepsGrid", start: 110, gap: 80 },
      ];
      let ticking = false;

      function updateCards() {
        const viewH = window.innerHeight;
        grids.forEach(({ id, start, gap }) => {
          const grid = root!.querySelector(`#${id}`);
          if (!grid) return;
          const cards = grid.querySelectorAll(".lp-scroll-card");
          const scrolled = viewH - grid.getBoundingClientRect().top;
          for (let i = 0; i < cards.length; i++) {
            const card = cards.item(i);
            if (!card) {
              continue;
            }

            card.classList.toggle("lp-visible", scrolled >= start + i * gap);
          }
        });
        ticking = false;
      }

      const cardsScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(updateCards); } };
      window.addEventListener("scroll", cardsScroll, { passive: true });
      updateCards();
      cleanups.push(() => window.removeEventListener("scroll", cardsScroll));
    }

    // 4. Animated counters (bidirectional)
    {
      const counters = root.querySelectorAll("[data-count]");
      if (counters.length) {
        const observer = new IntersectionObserver((entries) => {
          entries.forEach((e) => {
            const el = e.target as HTMLElement;
            if (e.isIntersecting) {
              if (el.dataset.counting) return;
              el.dataset.counting = "1";

              const target = parseFloat(el.dataset.count || "0");
              const decimals = parseInt(el.dataset.decimal || "0", 10);
              const suffix = el.dataset.suffix || "";
              const prefix = el.dataset.prefix || "";
              const duration = 1400;
              const startTime = performance.now();

              function tick(now: number) {
                const elapsed = now - startTime;
                const p = Math.min(elapsed / duration, 1);
                const eased = 1 - Math.pow(1 - p, 3);
                const current = target * eased;
                el.textContent = prefix + (decimals > 0 ? current.toFixed(decimals) : Math.round(current).toLocaleString("tr-TR")) + suffix;
                if (p < 1) requestAnimationFrame(tick);
                else delete el.dataset.counting;
              }
              requestAnimationFrame(tick);
            } else {
              const prefix = el.dataset.prefix || "";
              el.textContent = prefix + "0";
              delete el.dataset.counting;
            }
          });
        }, { threshold: 0.5, rootMargin: "0px 0px -50px 0px" });

        counters.forEach((c) => observer.observe(c));
        cleanups.push(() => observer.disconnect());
      }
    }

    // 5. Dashboard channel bars (bidirectional)
    {
      const bars = root.querySelectorAll(".lp-channel-bar-fill") as NodeListOf<HTMLElement>;
      if (bars.length) {
        const observer = new IntersectionObserver((entries) => {
          entries.forEach((e) => {
            const el = e.target as HTMLElement;
            if (e.isIntersecting) {
              el.style.width = el.dataset.width + "%";
            } else {
              el.style.width = "0";
            }
          });
        }, { threshold: 0.3, rootMargin: "0px 0px -50px 0px" });

        bars.forEach((b) => observer.observe(b));
        cleanups.push(() => observer.disconnect());
      }
    }

    // 6. Chat demo typing with loop
    {
      const container = root.querySelector("#chatDemo");
      if (container) {
        const msgEls = root.querySelectorAll("[data-chat-msg]");
        const messages = Array.from(msgEls).map((el) => ({
          type: (el as HTMLElement).dataset.chatType || "",
          text: (el as HTMLElement).dataset.chatMsg || "",
        }));

        let cancelled = false;

        function addMessage(msg: { type: string; text: string }, delay: number) {
          return new Promise<void>((resolve) => {
            const t = setTimeout(() => {
              if (cancelled) return;
              if (msg.type === "bot") {
                const typing = document.createElement("div");
                typing.className = "lp-chat-msg lp-bot";
                typing.innerHTML = '<div class="lp-typing-dots"><span></span><span></span><span></span></div>';
                container!.appendChild(typing);
                container!.scrollTop = container!.scrollHeight;
                const t2 = setTimeout(() => {
                  if (cancelled) return;
                  typing.remove();
                  const el = document.createElement("div");
                  el.className = "lp-chat-msg lp-bot";
                  el.textContent = msg.text;
                  el.style.opacity = "0";
                  el.style.transform = "translateY(8px)";
                  container!.appendChild(el);
                  requestAnimationFrame(() => {
                    el.style.transition = "all 0.3s cubic-bezier(0.22, 1, 0.36, 1)";
                    el.style.opacity = "1";
                    el.style.transform = "translateY(0)";
                  });
                  container!.scrollTop = container!.scrollHeight;
                  resolve();
                }, 500 + Math.random() * 200);
                cleanups.push(() => clearTimeout(t2));
              } else {
                const el = document.createElement("div");
                el.className = "lp-chat-msg lp-candidate";
                el.textContent = msg.text;
                el.style.opacity = "0";
                el.style.transform = "translateY(8px)";
                container!.appendChild(el);
                requestAnimationFrame(() => {
                  el.style.transition = "all 0.3s cubic-bezier(0.22, 1, 0.36, 1)";
                  el.style.opacity = "1";
                  el.style.transform = "translateY(0)";
                });
                container!.scrollTop = container!.scrollHeight;
                resolve();
              }
            }, delay);
            cleanups.push(() => clearTimeout(t));
          });
        }

        async function runChat() {
          if (cancelled) return;
          container!.innerHTML = "";
          for (let i = 0; i < messages.length; i++) {
            if (cancelled) return;
            const message = messages[i];
            if (!message) {
              continue;
            }

            await addMessage(message, i === 0 ? 200 : 700 + Math.random() * 300);
          }
          if (cancelled) return;
          chatLoopTimeout.current = setTimeout(runChat, 2000);
        }

        const chatGrid = root.querySelector("#chatDemoGrid") || container;
        const chatObserver = new IntersectionObserver((entries) => {
          const entry = entries[0];
          if (entry?.isIntersecting && !chatDemoStarted.current) {
            chatDemoStarted.current = true;
            setTimeout(runChat, 800);
          }
        }, { threshold: 0.15, rootMargin: "0px 0px -220px 0px" });

        chatObserver.observe(chatGrid);
        cleanups.push(() => {
          cancelled = true;
          chatObserver.disconnect();
          if (chatLoopTimeout.current) clearTimeout(chatLoopTimeout.current);
        });
      }
    }

    return () => {
      cleanups.forEach((fn) => fn());
      chatDemoStarted.current = false;
    };
  }, []);

  return (
    <div className="lp-landing-page" ref={pageRef}>
      {/* Hidden data carriers for chat messages */}
      {chatMessages.map((m, i) => (
        <span key={i} hidden data-chat-msg={m.text} data-chat-type={m.type} />
      ))}

      <div className="lp-page">
        <div className="lp-glow lp-glow-l" aria-hidden="true" />
        <div className="lp-glow lp-glow-r" aria-hidden="true" />

        {/* ═══ Hero ═══ */}
        <section className="lp-hero" id="hero">
          <div className="lp-hero-grid-bg" aria-hidden="true" />
          <div className="lp-hero-text-stack">
            <span className="lp-hero-line" data-index="0">{t("Ön Eleme.")}</span>
            <span className="lp-hero-line" data-index="1">{t("Kaynak Bulma.")}</span>
            <span className="lp-hero-line" data-index="2">{t("Mülakat.")}</span>
            <span className="lp-hero-tagline">{t("Yapay zekâ destekli işe alım platformu.")}</span>
          </div>
          <div className="lp-hero-bottom">
            <p className="lp-hero-sub">
              {t("Adaylarınızı hangi kanaldan ulaşırsa ulaşsın aynı hız, aynı kalite ve aynı profesyonellikle değerlendirin.")}
            </p>
            <div className="lp-hero-actions">
              <a href="/auth/signup" className="lp-btn">{t("Ücretsiz Deneyin")}</a>
              <a href="#workflow" className="lp-btn-ghost">{t("Nasıl çalışır?")}</a>
            </div>
          </div>
          <div className="lp-hero-scroll-cue" aria-hidden="true">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 5v14m0 0l-6-6m6 6l6-6" />
            </svg>
          </div>
        </section>

        {/* ═══ Manifesto ═══ */}
        <section className="lp-manifesto" id="manifesto">
          <div className="lp-shell">
            <p className="lp-manifesto-text" id="manifestoText">
              {manifestoWords.map((w, i) => (
                <span key={i}>
                  <span className={`lp-mw${w.em ? " lp-em" : ""}`}>{w.word}</span>
                  {i < manifestoWords.length - 1 ? " " : ""}
                </span>
              ))}
            </p>
          </div>
        </section>

        {/* ═══ Dashboard mockup ═══ */}
        <section className="lp-dashboard-section">
          <div className="lp-shell">
            <div className="lp-dashboard-frame lp-reveal-scale">
              <div className="lp-dashboard-topbar">
                <span className="lp-dashboard-topbar-title">{t("İşe Alım Paneli")}</span>
                <div className="lp-dashboard-topbar-pills">
                  <span>{t("Bugün")}</span>
                  <span className="lp-active-pill">{t("Bu Hafta")}</span>
                  <span>{t("Bu Ay")}</span>
                </div>
              </div>
              <div className="lp-metrics-row">
                <div className="lp-metric-card lp-reveal lp-reveal-delay-1">
                  <div className="lp-metric-label">{t("Toplam Aday")}</div>
                  <div className="lp-metric-value" data-color="primary" data-count="3842">0</div>
                  <div className="lp-metric-trend">{t("+186 bu hafta")}</div>
                </div>
                <div className="lp-metric-card lp-reveal lp-reveal-delay-2">
                  <div className="lp-metric-label">{t("Aktif Pozisyon")}</div>
                  <div className="lp-metric-value" data-color="accent" data-count="24">0</div>
                  <div className="lp-metric-trend">{t("12 departmanda")}</div>
                </div>
                <div className="lp-metric-card lp-reveal lp-reveal-delay-3">
                  <div className="lp-metric-label">{t("Tamamlanan Mülakat")}</div>
                  <div className="lp-metric-value" data-color="info" data-count="1247">0</div>
                  <div className="lp-metric-trend">{t("+23% önceki haftaya göre")}</div>
                </div>
                <div className="lp-metric-card lp-reveal lp-reveal-delay-4">
                  <div className="lp-metric-label">{t("İşe Alım Oranı")}</div>
                  <div className="lp-metric-value" data-color="warning" data-count="18.4" data-suffix="%" data-decimal="1">0</div>
                  <div className="lp-metric-trend">{t("+3.2% artış")}</div>
                </div>
              </div>
              <div className="lp-dashboard-body">
                <div className="lp-channel-bars">
                  <div className="lp-channel-bar-item">
                    <span className="lp-channel-bar-name">{t("AI Mülakat")}</span>
                    <div className="lp-channel-bar-track"><div className="lp-channel-bar-fill" data-color="accent" data-width="42" /></div>
                    <span className="lp-channel-bar-pct">42%</span>
                  </div>
                  <div className="lp-channel-bar-item">
                    <span className="lp-channel-bar-name">{t("Ön Eleme")}</span>
                    <div className="lp-channel-bar-track"><div className="lp-channel-bar-fill" data-color="info" data-width="31" /></div>
                    <span className="lp-channel-bar-pct">31%</span>
                  </div>
                  <div className="lp-channel-bar-item">
                    <span className="lp-channel-bar-name">{t("CV Analizi")}</span>
                    <div className="lp-channel-bar-track"><div className="lp-channel-bar-fill" data-color="warning" data-width="18" /></div>
                    <span className="lp-channel-bar-pct">18%</span>
                  </div>
                  <div className="lp-channel-bar-item">
                    <span className="lp-channel-bar-name">{t("Değerlendirme")}</span>
                    <div className="lp-channel-bar-track"><div className="lp-channel-bar-fill" data-color="primary" data-width="9" /></div>
                    <span className="lp-channel-bar-pct">9%</span>
                  </div>
                </div>
                <div className="lp-activity-feed">
                  <div className="lp-activity-item">
                    <span className="lp-activity-dot" style={{ background: "var(--lp-accent)" }} />
                    <span className="lp-activity-text">{t("Yeni aday mülakata başladı")}</span>
                    <span className="lp-activity-time">{t("2dk önce")}</span>
                  </div>
                  <div className="lp-activity-item">
                    <span className="lp-activity-dot" style={{ background: "var(--lp-info)" }} />
                    <span className="lp-activity-text">{t("AI değerlendirme tamamlandı")}</span>
                    <span className="lp-activity-time">{t("5dk önce")}</span>
                  </div>
                  <div className="lp-activity-item">
                    <span className="lp-activity-dot" style={{ background: "var(--lp-warning)" }} />
                    <span className="lp-activity-text">{t("3 yeni başvuru alındı")}</span>
                    <span className="lp-activity-time">{t("12dk önce")}</span>
                  </div>
                  <div className="lp-activity-item">
                    <span className="lp-activity-dot" style={{ background: "var(--lp-primary)" }} />
                    <span className="lp-activity-text">{t("Aday raporu oluşturuldu")}</span>
                    <span className="lp-activity-time">{t("18dk önce")}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ Channels ═══ */}
        <section className="lp-channels" id="channels">
          <div className="lp-shell">
            <div className="lp-channels-header lp-reveal">
              <span className="lp-kicker">{t("Modüller")}</span>
              <h2 className="lp-section-title">{t("Her adımda aynı kalite")}</h2>
              <p className="lp-section-sub" style={{ margin: "0 auto" }}>{t("İş ilanı, başvuru toplama, ön eleme ve AI mülakat süreçlerinin hepsi tek platformda yönetilir.")}</p>
            </div>
            <div className="lp-channels-grid" id="channelsGrid">
              <div className="lp-channel-card lp-ch-2 lp-scroll-card">
                <div className="lp-channel-icon">{"\u{1F399}\u{FE0F}"}</div>
                <h3>{t("AI Mülakat")}</h3>
                <p>{t("Adaylara otomatik sesli veya yazılı mülakat uygulayın. AI, yanıtları anlık analiz eder ve puanlar.")}</p>
              </div>
              <div className="lp-channel-card lp-ch-1 lp-scroll-card">
                <div className="lp-channel-icon">{"\u{1F4CB}"}</div>
                <h3>{t("Aday Değerlendirme")}</h3>
                <p>{t("Yetkinlik bazlı AI puanlaması ile adayları objektif şekilde karşılaştırın ve sıralayın.")}</p>
              </div>
              <div className="lp-channel-card lp-ch-3 lp-scroll-card">
                <div className="lp-channel-icon">{"\u{1F465}"}</div>
                <h3>{t("Aday Yönetimi")}</h3>
                <p>{t("Tüm başvuruları tek panelden takip edin. Durum güncellemeleri ve iletişim otomatik yönetilir.")}</p>
              </div>
              <div className="lp-channel-card lp-ch-4 lp-scroll-card">
                <div className="lp-channel-icon">{"\u{1F4CA}"}</div>
                <h3>{t("Analitik")}</h3>
                <p>{t("İşe alım süreci metriklerini gerçek zamanlı izleyin. Darboğazları tespit edip süreci optimize edin.")}</p>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ Interview Room Mockup ═══ */}
        <section className="lp-chat-demo">
          <div className="lp-shell">
            <div className="lp-chat-demo-grid lp-reveal-sync" id="chatDemoGrid">
              <div className="lp-chat-demo-copy lp-sync-left">
                <span className="lp-kicker">{t("Canlı Mülakat")}</span>
                <h2 className="lp-section-title">{t("Gerçek zamanlı AI görüşme odası")}</h2>
                <p className="lp-section-sub">{t("Aday ve AI asistan karşılıklı görüşür. Transcript anlık oluşur, değerlendirme otomatik yapılır.")}</p>
              </div>
              <div className="lp-interview-room lp-sync-right">
                {/* Video area - 2 participants */}
                <div className="lp-interview-video-grid">
                  <div className="lp-interview-participant">
                    <div className="lp-interview-avatar-candit">
                      <span>C</span>
                    </div>
                    <span className="lp-interview-name">{t("Candit Asistan")}</span>
                    <span className="lp-interview-role-tag">{t("AI Mülakat")}</span>
                  </div>
                  <div className="lp-interview-participant">
                    <div className="lp-interview-avatar-candidate">
                      <svg viewBox="0 0 40 40" width="56" height="56" fill="none">
                        <circle cx="20" cy="14" r="8" fill="var(--lp-accent)" opacity="0.7" />
                        <ellipse cx="20" cy="36" rx="14" ry="10" fill="var(--lp-accent)" opacity="0.5" />
                      </svg>
                    </div>
                    <span className="lp-interview-name">{t("Selen Yılmaz")}</span>
                    <span className="lp-interview-role-tag">{t("Aday")}</span>
                  </div>
                </div>
                {/* Live transcript */}
                <div className="lp-interview-transcript" id="chatDemo">
                  {/* Messages injected by JS */}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ Proof stats ═══ */}
        <section className="lp-proof" id="impact">
          <div className="lp-shell">
            <div className="lp-proof-grid" id="proofGrid">
              <div className="lp-proof-card lp-scroll-card">
                <p className="lp-proof-value" data-color="primary" data-count="87" data-prefix="%">0</p>
                <h2>{t("Daha Hızlı İşe Alım")}</h2>
                <p>{t("İşe alım sürecini otomatikleştirerek ortalama kapanma süresini %87 kısaltın.")}</p>
              </div>
              <div className="lp-proof-card lp-scroll-card">
                <p className="lp-proof-value" data-color="accent">7/24</p>
                <h2>{t("Kesintisiz Mülakat")}</h2>
                <p>{t("AI mülakat 7 gün 24 saat aktif. Adaylar istedikleri zaman mülakata girebilir.")}</p>
              </div>
              <div className="lp-proof-card lp-scroll-card">
                <p className="lp-proof-value" data-color="info" data-count="12" data-suffix="x">0</p>
                <h2>{t("Verimlilik Artışı")}</h2>
                <p>{t("İnsan kaynakları ekibinizin verimliliği ortalama 12 kat artar.")}</p>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ Workflow ═══ */}
        <section className="lp-workflow" id="workflow">
          <div className="lp-shell">
            <div className="lp-workflow-header lp-reveal">
              <span className="lp-kicker">{t("Nasıl Çalışır")}</span>
              <h2 className="lp-section-title">{t("Dört adımda işe alıma başlayın")}</h2>
              <p className="lp-section-sub" style={{ margin: "0 auto" }}>{t("Pozisyonu tanımlayın, adayları analiz edin, AI mülakat yaptırın, en iyi adayı seçin.")}</p>
            </div>
            <div className="lp-steps-grid" id="stepsGrid">
              <div className="lp-step-card lp-scroll-card">
                <span className="lp-step-num">01</span>
                <h3>{t("Pozisyonu Tanımlayın")}</h3>
                <p>{t("İş ilanını oluşturun, mülakat sorularını ve değerlendirme kriterlerini belirleyin.")}</p>
              </div>
              <div className="lp-step-card lp-scroll-card">
                <span className="lp-step-num">02</span>
                <h3>{t("Adayları Analiz Edin")}</h3>
                <p>{t("CV'leri otomatik analiz edin, ön eleme kriterleriyle adayları filtreleyin.")}</p>
              </div>
              <div className="lp-step-card lp-scroll-card">
                <span className="lp-step-num">03</span>
                <h3>{t("AI Mülakat Yaptırın")}</h3>
                <p>{t("Adaylar AI ile mülakat yapar, yanıt kalitesi ve yetkinlikleri otomatik puanlanır.")}</p>
              </div>
              <div className="lp-step-card lp-scroll-card">
                <span className="lp-step-num">04</span>
                <h3>{t("En İyi Adayı Seçin")}</h3>
                <p>{t("Karşılaştırmalı raporlarla en uygun adayı belirleyin ve teklifinizi iletin.")}</p>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ Features ═══ */}
        <section className="lp-features" id="features">
          <div className="lp-shell">
            <div className="lp-feature-row">
              <div className="lp-reveal-right lp-reveal-late">
                <span className="lp-kicker">{t("Güvenlik")}</span>
                <h2 className="lp-section-title">{t("Verileriniz güvendedir")}</h2>
                <p className="lp-section-sub">{t("KVKK uyumlu altyapı, şifrelenmiş veri depolama ve erişim kontrolleri ile tam güvenlik.")}</p>
              </div>
              <div className="lp-feature-visual lp-reveal-left lp-reveal-late">
                <div className="lp-feature-visual-title">{t("Güvenlik Katmanları")}</div>
                <div className="lp-shield-grid">
                  <div className="lp-shield-item">
                    <strong>{"\u{1F510}"} {t("Kimlik Doğrulama")}</strong>
                    <span>{t("Çok faktörlü güvenli giriş")}</span>
                  </div>
                  <div className="lp-shield-item">
                    <strong>{"\u{1F6E1}\u{FE0F}"} {t("AI Koruma")}</strong>
                    <span>{t("Uygunsuz içerik filtreleme")}</span>
                  </div>
                  <div className="lp-shield-item">
                    <strong>{"\u{1F512}"} {t("Veri Şifreleme")}</strong>
                    <span>{t("AES-256 şifreleme")}</span>
                  </div>
                  <div className="lp-shield-item">
                    <strong>{"\u{1F4CB}"} {t("KVKK Uyumu")}</strong>
                    <span>{t("Tam uyumlu veri işleme")}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ CTA ═══ */}
        <section className="lp-cta" id="cta">
          <div className="lp-shell">
            <div className="lp-cta-panel lp-reveal-scale">
              <span className="lp-kicker">{t("Başlayalım")}</span>
              <h2 className="lp-section-title">{t("Adaylara hak ettikleri deneyimi sunun")}</h2>
              <p className="lp-section-sub">{t("Ücretsiz deneme ile başlayıp, dakikalar içinde ilk AI mülakatınızı oluşturun.")}</p>
              <div className="lp-cta-actions">
                <a href="/auth/signup" className="lp-btn">{t("Ücretsiz Deneyin")}</a>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
