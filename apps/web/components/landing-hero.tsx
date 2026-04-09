"use client";

import { useEffect, useRef, useMemo } from "react";
import "./landing-hero.css";

const SITE_BRAND = "Candit.ai";

/* ── Manifesto text and emphasis words ── */
const MANIFESTO_TEXT =
  "Her aday, hangi pozisyon veya kanaldan gelirse gelsin ayni profesyonellik ve objektiflikle degerlendirilmeli. Candit.ai bu vizyonu urunun merkezine yerlestirdi.";
const MANIFESTO_EMPHASIS = "aday,profesyonellik,objektiflikle,Candit.ai,vizyonu";

/* ── Chat demo messages ── */
const CHAT_MESSAGES = [
  { type: "candidate", text: "Merhaba, basvurumu gonderdim. Mulakat sureci nasil isliyor?" },
  { type: "bot", text: "Hos geldiniz! Basvurunuz alindi. Simdi size kisa bir AI mulakat gonderecegim. Hazir oldugunuzda baslayabilirsiniz." },
  { type: "candidate", text: "Harika, hemen baslamak istiyorum!" },
  { type: "bot", text: "Mukemmel! Mulakat linkiniz hazirlandi. Basarilar dileriz! Ortalama sure 15 dakikadir." },
];

export function LandingHero() {
  const pageRef = useRef<HTMLDivElement>(null);
  const chatDemoStarted = useRef(false);
  const chatLoopTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Manifesto: split text into words, mark emphasis ── */
  const manifestoWords = useMemo(() => {
    const emphasisSet = new Set(MANIFESTO_EMPHASIS.split(",").map((w) => w.trim().toLowerCase()));
    return MANIFESTO_TEXT.split(/\s+/).map((word) => ({
      word,
      em: emphasisSet.has(word.toLowerCase()),
    }));
  }, []);

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
        const thresholds = [0, 80, 150, 220];
        for (let i = 0; i < lines.length; i++) {
          lines[i].classList.toggle("lp-active", scrolled >= thresholds[i]);
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
            words[i].classList.toggle("lp-lit", progress >= threshold);
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
            cards[i].classList.toggle("lp-visible", scrolled >= start + i * gap);
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
            await addMessage(messages[i], i === 0 ? 200 : 700 + Math.random() * 300);
          }
          if (cancelled) return;
          chatLoopTimeout.current = setTimeout(runChat, 2000);
        }

        const chatGrid = root.querySelector("#chatDemoGrid") || container;
        const chatObserver = new IntersectionObserver((entries) => {
          if (entries[0].isIntersecting && !chatDemoStarted.current) {
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
      {CHAT_MESSAGES.map((m, i) => (
        <span key={i} hidden data-chat-msg={m.text} data-chat-type={m.type} />
      ))}

      <div className="lp-page">
        <div className="lp-glow lp-glow-l" aria-hidden="true" />
        <div className="lp-glow lp-glow-r" aria-hidden="true" />

        {/* ═══ Hero ═══ */}
        <section className="lp-hero" id="hero">
          <div className="lp-hero-grid-bg" aria-hidden="true" />
          <div className="lp-hero-text-stack">
            <span className="lp-hero-line" data-index="0">AI ile</span>
            <span className="lp-hero-line" data-index="1">ise alimin</span>
            <span className="lp-hero-line" data-index="2">gelecegi</span>
            <span className="lp-hero-line" data-index="3">burada.</span>
            <span className="lp-hero-tagline">Mulakat. Degerlendirme. Ise Alim.</span>
          </div>
          <div className="lp-hero-bottom">
            <p className="lp-hero-sub">
              Adaylarinizi hangi kanaldan ulasirsa ulassin ayni hiz, ayni kalite ve ayni
              profesyonellikle degerlendirin. {SITE_BRAND} ile ise alim surecini otomatiklestirin.
            </p>
            <div className="lp-hero-actions">
              <a href="/auth/signup" className="lp-btn">Ucretsiz Deneyin</a>
              <a href="#workflow" className="lp-btn-ghost">Nasil calisir?</a>
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
                <span className="lp-dashboard-topbar-title">Ise Alim Paneli</span>
                <div className="lp-dashboard-topbar-pills">
                  <span>Bugun</span>
                  <span className="lp-active-pill">Bu Hafta</span>
                  <span>Bu Ay</span>
                </div>
              </div>
              <div className="lp-metrics-row">
                <div className="lp-metric-card lp-reveal lp-reveal-delay-1">
                  <div className="lp-metric-label">Mulakatlar</div>
                  <div className="lp-metric-value" data-color="primary" data-count="1247">0</div>
                  <div className="lp-metric-trend">+23% onceki haftaya gore</div>
                </div>
                <div className="lp-metric-card lp-reveal lp-reveal-delay-2">
                  <div className="lp-metric-label">Tamamlanma Orani</div>
                  <div className="lp-metric-value" data-color="accent" data-count="94.2" data-suffix="%" data-decimal="1">0</div>
                  <div className="lp-metric-trend">+5.1% artis</div>
                </div>
                <div className="lp-metric-card lp-reveal lp-reveal-delay-3">
                  <div className="lp-metric-label">Ort. Mulakat Suresi</div>
                  <div className="lp-metric-value" data-color="info" data-count="14.8" data-suffix="dk" data-decimal="1">0</div>
                  <div className="lp-metric-trend">-2.3dk iyilesme</div>
                </div>
                <div className="lp-metric-card lp-reveal lp-reveal-delay-4">
                  <div className="lp-metric-label">Aday Memnuniyeti</div>
                  <div className="lp-metric-value" data-color="warning" data-count="4.7" data-suffix="/5" data-decimal="1">0</div>
                  <div className="lp-metric-trend">+0.3 puan artis</div>
                </div>
              </div>
              <div className="lp-dashboard-body">
                <div className="lp-channel-bars">
                  <div className="lp-channel-bar-item">
                    <span className="lp-channel-bar-name">AI Mulakat</span>
                    <div className="lp-channel-bar-track"><div className="lp-channel-bar-fill" data-color="accent" data-width="42" /></div>
                    <span className="lp-channel-bar-pct">42%</span>
                  </div>
                  <div className="lp-channel-bar-item">
                    <span className="lp-channel-bar-name">On Eleme</span>
                    <div className="lp-channel-bar-track"><div className="lp-channel-bar-fill" data-color="info" data-width="31" /></div>
                    <span className="lp-channel-bar-pct">31%</span>
                  </div>
                  <div className="lp-channel-bar-item">
                    <span className="lp-channel-bar-name">CV Analizi</span>
                    <div className="lp-channel-bar-track"><div className="lp-channel-bar-fill" data-color="warning" data-width="18" /></div>
                    <span className="lp-channel-bar-pct">18%</span>
                  </div>
                  <div className="lp-channel-bar-item">
                    <span className="lp-channel-bar-name">Degerlendirme</span>
                    <div className="lp-channel-bar-track"><div className="lp-channel-bar-fill" data-color="primary" data-width="9" /></div>
                    <span className="lp-channel-bar-pct">9%</span>
                  </div>
                </div>
                <div className="lp-activity-feed">
                  <div className="lp-activity-item">
                    <span className="lp-activity-dot" style={{ background: "var(--lp-accent)" }} />
                    <span className="lp-activity-text">Yeni aday mulakata basladi</span>
                    <span className="lp-activity-time">2dk once</span>
                  </div>
                  <div className="lp-activity-item">
                    <span className="lp-activity-dot" style={{ background: "var(--lp-info)" }} />
                    <span className="lp-activity-text">AI degerlendirme tamamlandi</span>
                    <span className="lp-activity-time">5dk once</span>
                  </div>
                  <div className="lp-activity-item">
                    <span className="lp-activity-dot" style={{ background: "var(--lp-warning)" }} />
                    <span className="lp-activity-text">3 yeni basvuru alindi</span>
                    <span className="lp-activity-time">12dk once</span>
                  </div>
                  <div className="lp-activity-item">
                    <span className="lp-activity-dot" style={{ background: "var(--lp-primary)" }} />
                    <span className="lp-activity-text">Aday raporu olusturuldu</span>
                    <span className="lp-activity-time">18dk once</span>
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
              <span className="lp-kicker">MODULLER</span>
              <h2 className="lp-section-title">Her adimda ayni kalite</h2>
              <p className="lp-section-sub" style={{ margin: "0 auto" }}>Is ilani, basvuru toplama, on eleme ve AI mulakat sureclerinin hepsi tek platformda yonetilir.</p>
            </div>
            <div className="lp-channels-grid" id="channelsGrid">
              <div className="lp-channel-card lp-ch-2 lp-scroll-card">
                <div className="lp-channel-icon">{"\u{1F399}\u{FE0F}"}</div>
                <h3>AI Mulakat</h3>
                <p>Adaylara otomatik sesli veya yazili mulakat uygulatin. AI, yanitlari anlik analiz eder ve puanlar.</p>
              </div>
              <div className="lp-channel-card lp-ch-1 lp-scroll-card">
                <div className="lp-channel-icon">{"\u{1F4CB}"}</div>
                <h3>Aday Degerlendirme</h3>
                <p>Yetkinlik bazli AI puanlamasi ile adaylari objektif sekilde karsilastirin ve sirayin.</p>
              </div>
              <div className="lp-channel-card lp-ch-3 lp-scroll-card">
                <div className="lp-channel-icon">{"\u{1F465}"}</div>
                <h3>Aday Yonetimi</h3>
                <p>Tum basvurulari tek panelden takip edin. Durum guncellemeleri ve iletisim otomatik yonetilir.</p>
              </div>
              <div className="lp-channel-card lp-ch-4 lp-scroll-card">
                <div className="lp-channel-icon">{"\u{1F4CA}"}</div>
                <h3>Analitik</h3>
                <p>Ise alim sureci metriklerini gercek zamanli izleyin. Darbogazlari tespit edip sureci optimize edin.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ Chat demo ═══ */}
        <section className="lp-chat-demo">
          <div className="lp-shell">
            <div className="lp-chat-demo-grid lp-reveal-sync" id="chatDemoGrid">
              <div className="lp-chat-demo-copy lp-sync-left">
                <span className="lp-kicker">CANLI DEMO</span>
                <h2 className="lp-section-title">Aday deneyimini canli gorun</h2>
                <p className="lp-section-sub">AI mulakatinizin adayla nasil etkilesime gectigini gercek zamanli izleyin.</p>
              </div>
              <div className="lp-chat-window lp-sync-right">
                <div className="lp-chat-header">
                  <div className="lp-chat-avatar">CA</div>
                  <div className="lp-chat-header-info">
                    <strong>{SITE_BRAND} Asistani</strong>
                    <span>&#9679; Cevrimici</span>
                  </div>
                </div>
                <div className="lp-chat-messages" id="chatDemo">
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
                <h2>Daha Hizli Ise Alim</h2>
                <p>Ise alim surecini otomatiklestirerek ortalama kapanma suresini %87 kisaltin.</p>
              </div>
              <div className="lp-proof-card lp-scroll-card">
                <p className="lp-proof-value" data-color="accent">7/24</p>
                <h2>Kesintisiz Mulakat</h2>
                <p>AI mulakat 7 gun 24 saat aktif. Adaylar istedikleri zaman mulakata girebilir.</p>
              </div>
              <div className="lp-proof-card lp-scroll-card">
                <p className="lp-proof-value" data-color="info" data-count="12" data-suffix="x">0</p>
                <h2>Verimlilik Artisi</h2>
                <p>Insan kaynaklari ekibinizin verimliligi ortalama 12 kat artar.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ Workflow ═══ */}
        <section className="lp-workflow" id="workflow">
          <div className="lp-shell">
            <div className="lp-workflow-header lp-reveal">
              <span className="lp-kicker">NASIL CALISIR</span>
              <h2 className="lp-section-title">Dort adimda ise alima baslayin</h2>
              <p className="lp-section-sub" style={{ margin: "0 auto" }}>Pozisyonu tanimlayin, adaylari toplayin, AI mulakat yaptirin, en iyi adayi secin.</p>
            </div>
            <div className="lp-steps-grid" id="stepsGrid">
              <div className="lp-step-card lp-scroll-card">
                <span className="lp-step-num">01</span>
                <h3>Pozisyonu Tanimlayin</h3>
                <p>Is ilanini olusturun, mulakat sorularini ve degerlendirme kriterlerini belirleyin.</p>
              </div>
              <div className="lp-step-card lp-scroll-card">
                <span className="lp-step-num">02</span>
                <h3>Adaylari Toplayin</h3>
                <p>Basvuru formunu paylasin veya mevcut adaylara davetiye gonderin.</p>
              </div>
              <div className="lp-step-card lp-scroll-card">
                <span className="lp-step-num">03</span>
                <h3>AI Mulakat Yaptirin</h3>
                <p>Adaylar AI ile mulakat yapar, yanit kalitesi ve yetkinlikleri otomatik puanlanir.</p>
              </div>
              <div className="lp-step-card lp-scroll-card">
                <span className="lp-step-num">04</span>
                <h3>En Iyi Adayi Secin</h3>
                <p>Karsilastirmali raporlarla en uygun adayi belirleyin ve teklifinizi iletin.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ Features ═══ */}
        <section className="lp-features" id="features">
          <div className="lp-shell">
            <div className="lp-feature-row">
              <div className="lp-reveal-left lp-reveal-late">
                <span className="lp-kicker">ENTEGRASYONLAR</span>
                <h2 className="lp-section-title">Mevcut sistemlerinizle uyumlu</h2>
                <p className="lp-section-sub">ATS, HRIS ve iletisim platformlarinizla entegre calisin. Veri senkronizasyonu otomatik yapilir.</p>
              </div>
              <div className="lp-feature-visual lp-reveal-right lp-reveal-late">
                <div className="lp-feature-visual-title">ENTEGRASYON PARTNERLERI</div>
                <div className="lp-integration-logos-grid">
                  <div className="lp-integration-logo-card">
                    <span style={{ fontSize: "28px" }}>{"\u{1F4E7}"}</span>
                    <span>Email</span>
                  </div>
                  <div className="lp-integration-logo-card">
                    <span style={{ fontSize: "28px" }}>{"\u{1F4AC}"}</span>
                    <span>WhatsApp</span>
                  </div>
                  <div className="lp-integration-logo-card">
                    <span style={{ fontSize: "28px" }}>{"\u{1F517}"}</span>
                    <span>Webhook</span>
                  </div>
                  <div className="lp-integration-logo-card">
                    <span style={{ fontSize: "28px" }}>{"\u{2699}\u{FE0F}"}</span>
                    <span>API</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="lp-feature-row lp-reverse">
              <div className="lp-reveal-right lp-reveal-late">
                <span className="lp-kicker">GUVENLIK</span>
                <h2 className="lp-section-title">Verileriniz guvendedir</h2>
                <p className="lp-section-sub">KVKK uyumlu altyapi, sifrelenmis veri depolama ve erisim kontrolleri ile tam guvenlik.</p>
              </div>
              <div className="lp-feature-visual lp-reveal-left lp-reveal-late">
                <div className="lp-feature-visual-title">GUVENLIK KATMANLARI</div>
                <div className="lp-shield-grid">
                  <div className="lp-shield-item">
                    <strong>{"\u{1F510}"} Kimlik Dogrulama</strong>
                    <span>Cok faktorlu guvenli giris</span>
                  </div>
                  <div className="lp-shield-item">
                    <strong>{"\u{1F6E1}\u{FE0F}"} AI Koruma</strong>
                    <span>Uygunsuz icerik filtreleme</span>
                  </div>
                  <div className="lp-shield-item">
                    <strong>{"\u{1F512}"} Veri Sifreleme</strong>
                    <span>AES-256 sifreleme</span>
                  </div>
                  <div className="lp-shield-item">
                    <strong>{"\u{1F4CB}"} KVKK Uyumu</strong>
                    <span>Tam uyumlu veri isleme</span>
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
              <span className="lp-kicker">BASLAYALIM</span>
              <h2 className="lp-section-title">Adaylara hak ettikleri deneyimi sunun</h2>
              <p className="lp-section-sub">Ucretsiz deneme ile baslayip, dakikalar icinde ilk AI mulakatinizi olusturun.</p>
              <div className="lp-cta-actions">
                <a href="/auth/signup" className="lp-btn">Ucretsiz Deneyin</a>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
