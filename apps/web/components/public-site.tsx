import type { ReactNode } from "react";
import styles from "./public-site.module.css";
import {
  PUBLIC_ABOUT_STATS,
  PUBLIC_ABOUT_STORY,
  PUBLIC_BLOG_ARTICLES,
  PUBLIC_CHANGELOG,
  PUBLIC_CONTACT_METRICS,
  PUBLIC_CONTACT_TRUST,
  PUBLIC_FAQ,
  PUBLIC_FEATURE_GROUPS,
  PUBLIC_FEATURE_HERO_ACTIONS,
  PUBLIC_FEATURE_OPERATIONS,
  PUBLIC_FOOTER_COLUMNS,
  PUBLIC_HELP_QUICKSTART,
  PUBLIC_HELP_TOPICS,
  PUBLIC_HOME_CHANNELS,
  PUBLIC_HOME_PROOF,
  PUBLIC_HOME_STEPS,
  PUBLIC_INTEGRATION_GROUPS,
  PUBLIC_PAY_AS_YOU_GO,
  PUBLIC_PRICING_PLANS,
  PUBLIC_PRIVACY_SECTIONS,
  PUBLIC_SECURITY_GROUPS,
  PUBLIC_SOLUTIONS,
  PUBLIC_SOLUTIONS_ADVANTAGES,
  PUBLIC_SOLUTIONS_STATS,
  PUBLIC_TEAM,
  PUBLIC_TERMS_SECTIONS,
  PUBLIC_TOP_NAV,
  getBlogArticleBySlug,
  getSolutionBySlug,
  type PublicAction,
  type PublicBlogArticle,
  type PublicCard,
  type PublicFaq,
  type PublicLegalSection,
  type PublicSolution,
  type PublicStat,
  type PublicStep,
  type PublicTimelineEntry
} from "../lib/public-site-data";

const SITE_BRAND = "Telyx.ai";
const SITE_TAGLINE = "Tek AI, tum kanallar.";

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function ActionLink({
  action,
  tone,
  fullWidth
}: {
  action: PublicAction;
  tone?: "primary" | "secondary";
  fullWidth?: boolean;
}) {
  const resolvedTone = tone ?? action.tone ?? "primary";
  const className = cn(
    styles.button,
    resolvedTone === "secondary" ? styles.buttonSecondary : styles.buttonPrimary,
    fullWidth && styles.buttonBlock
  );

  return (
    <a href={action.href} className={className}>
      <span>{action.label}</span>
      {resolvedTone === "primary" ? <span aria-hidden="true">-&gt;</span> : null}
    </a>
  );
}

function SectionHeader({
  eyebrow,
  title,
  subtitle,
  align = "left"
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: "left" | "center";
}) {
  return (
    <div className={cn(styles.sectionHeader, align === "center" && styles.sectionHeaderCentered)}>
      {eyebrow ? <span className={styles.eyebrow}>{eyebrow}</span> : null}
      <h2 className={styles.sectionTitle}>{title}</h2>
      {subtitle ? <p className={styles.sectionSubtitle}>{subtitle}</p> : null}
    </div>
  );
}

function SiteHeader({ activeHref }: { activeHref?: string }) {
  return (
    <header className={styles.header}>
      <div className={cn(styles.shell, styles.headerInner)}>
        <a href="/" className={styles.brand} aria-label={`${SITE_BRAND} ana sayfa`}>
          <span className={styles.brandMark}>T</span>
          <span className={styles.brandCopy}>
            <strong>{SITE_BRAND}</strong>
            <span>Cok kanalli AI platformu</span>
          </span>
        </a>

        <nav className={styles.nav} aria-label="Public navigation">
          {PUBLIC_TOP_NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={cn(styles.navLink, activeHref === item.href && styles.navLinkActive)}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className={styles.headerActions}>
          <div className={styles.languagePill} aria-hidden="true">
            <span className={styles.languagePillActive}>TR</span>
            <span>EN</span>
          </div>
          <a href="/auth/login" className={styles.headerTextAction}>
            Giris Yap
          </a>
          <ActionLink action={{ label: "Demo Talep Edin", href: "/waitlist" }} />
        </div>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.shell}>
        <div className={styles.footerGrid}>
          <div className={styles.footerBrand}>
            <a href="/" className={styles.brand}>
              <span className={styles.brandMark}>T</span>
              <span className={styles.brandCopy}>
                <strong>{SITE_BRAND}</strong>
                <span>Telefon, WhatsApp, Chat ve Email icin tek AI katmani.</span>
              </span>
            </a>
            <p className={styles.footerCopy}>
              Telyx public site kurgusu bu projeye tasindi. Iceriklerin tamamini sonraki turda
              proje diline gore rahatca guncelleyebiliriz.
            </p>
          </div>

          {PUBLIC_FOOTER_COLUMNS.map((column) => (
            <div key={column.title} className={styles.footerColumn}>
              <h3>{column.title}</h3>
              <div className={styles.footerLinks}>
                {column.links.map((item) => (
                  <a key={item.href} href={item.href}>
                    {item.label}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className={styles.footerBottom}>
          <span>(c) 2026 {SITE_BRAND}. Tum haklari saklidir.</span>
          <div className={styles.footerBottomLinks}>
            <a href="/privacy">Gizlilik</a>
            <a href="/terms">Kullanim Kosullari</a>
            <a href="/contact">Iletisim</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

function PublicSiteFrame({
  activeHref,
  children
}: {
  activeHref?: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.page}>
      <div className={styles.pageGlowLeft} aria-hidden="true" />
      <div className={styles.pageGlowRight} aria-hidden="true" />
      <SiteHeader activeHref={activeHref} />
      <main className={styles.main}>{children}</main>
      <SiteFooter />
    </div>
  );
}

function StatsGrid({ items, columns = 3 }: { items: PublicStat[]; columns?: 3 | 4 }) {
  return (
    <div className={cn(styles.statsGrid, columns === 4 && styles.statsGridFour)}>
      {items.map((item) => (
        <article key={`${item.label}-${item.value}`} className={styles.metricCard}>
          <strong>{item.value}</strong>
          <h3>{item.label}</h3>
          {item.detail ? <p>{item.detail}</p> : null}
        </article>
      ))}
    </div>
  );
}

function CardGrid({
  cards,
  columns = 3
}: {
  cards: PublicCard[];
  columns?: 2 | 3 | 4;
}) {
  return (
    <div
      className={cn(
        styles.cardGrid,
        columns === 2 && styles.cardGridTwo,
        columns === 4 && styles.cardGridFour
      )}
    >
      {cards.map((card) => (
        <article key={`${card.title}-${card.body}`} className={styles.card}>
          {card.badge ? <span className={styles.cardBadge}>{card.badge}</span> : null}
          {card.eyebrow ? <span className={styles.cardEyebrow}>{card.eyebrow}</span> : null}
          {card.icon ? <span className={styles.cardIcon}>{card.icon}</span> : null}
          <h3>{card.title}</h3>
          <p>{card.body}</p>
          {card.meta ? <div className={styles.cardMeta}>{card.meta}</div> : null}
          {card.bullets?.length ? (
            <div className={styles.bulletList}>
              {card.bullets.map((bullet) => (
                <span key={bullet}>{bullet}</span>
              ))}
            </div>
          ) : null}
          {card.href && card.actionLabel ? (
            <a href={card.href} className={styles.inlineLink}>
              {card.actionLabel}
            </a>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function StepsGrid({ steps }: { steps: PublicStep[] }) {
  return (
    <div className={styles.stepsGrid}>
      {steps.map((step) => (
        <article key={`${step.step}-${step.title}`} className={styles.stepCard}>
          <span className={styles.stepIndex}>{step.step}</span>
          <h3>{step.title}</h3>
          <p>{step.body}</p>
        </article>
      ))}
    </div>
  );
}

function FAQBlock({ items }: { items: PublicFaq[] }) {
  return (
    <div className={styles.faqList}>
      {items.map((item) => (
        <details key={item.question} className={styles.faqItem}>
          <summary>{item.question}</summary>
          <p>{item.answer}</p>
        </details>
      ))}
    </div>
  );
}

function CTASection({
  title,
  body,
  primary = { label: "Demo Talep Edin", href: "/waitlist" },
  secondary = { label: "Fiyatlari Incele", href: "/pricing", tone: "secondary" }
}: {
  title: string;
  body: string;
  primary?: PublicAction;
  secondary?: PublicAction;
}) {
  return (
    <section className={styles.section}>
      <div className={cn(styles.shell, styles.ctaBand)}>
        <div>
          <span className={styles.eyebrow}>Hazir misiniz?</span>
          <h2 className={styles.ctaTitle}>{title}</h2>
          <p className={styles.ctaBody}>{body}</p>
        </div>
        <div className={styles.ctaActions}>
          <ActionLink action={primary} />
          <ActionLink action={secondary} tone="secondary" />
        </div>
      </div>
    </section>
  );
}

function ProductStage() {
  return (
    <div className={styles.stageShell}>
      <div className={styles.stageChrome}>
        <div className={styles.stageDots}>
          <span />
          <span />
          <span />
        </div>
        <span className={styles.livePill}>
          <i />
          All systems active
        </span>
      </div>

      <div className={styles.stageHeadline}>
        <div>
          <span className={styles.stageEyebrow}>Omnichannel command center</span>
          <h2>Tum kanallar ayni AI hafizasinda bulusur.</h2>
        </div>
        <div className={styles.stageScore}>
          <strong>%90</strong>
          <span>otomatik cozum orani</span>
        </div>
      </div>

      <div className={styles.stageTrack}>
        {PUBLIC_HOME_STEPS.map((step) => (
          <div key={step.step} className={styles.stageTrackStep}>
            <i />
            <strong>{step.title}</strong>
            <span>{step.body}</span>
          </div>
        ))}
      </div>

      <div className={styles.stagePanels}>
        <article className={styles.stagePanel}>
          <div className={styles.stagePanelLabel}>Kanallar</div>
          <div className={styles.inboundList}>
            {PUBLIC_HOME_CHANNELS.map((channel) => (
              <div key={channel.title} className={styles.inboundItem}>
                <span className={styles.channelBadge}>{channel.icon}</span>
                <div>
                  <strong>{channel.title}</strong>
                  <span>{channel.body}</span>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className={cn(styles.stagePanel, styles.stagePanelWide)}>
          <div className={styles.stagePanelLabel}>Canli operasyon gorunurlugu</div>
          <div className={styles.signalPanel}>
            <div className={styles.signalRing}>
              <span>7/24</span>
              <small>yanit</small>
            </div>

            <div className={styles.signalBody}>
              <h3>Tek AI katmani ile daha hizli, daha temiz operasyon.</h3>
              <p>
                Telefon, WhatsApp, web chat ve email uzerinden gelen tum talepler ayni
                sahiplenme mantigiyla yonetilir.
              </p>
              <div className={styles.progressList}>
                <div>
                  <span>Handoff kalitesi</span>
                  <i>
                    <b style={{ width: "82%" }} />
                  </i>
                </div>
                <div>
                  <span>SLA uyumu</span>
                  <i>
                    <b style={{ width: "91%" }} />
                  </i>
                </div>
                <div>
                  <span>Kanal kapsami</span>
                  <i>
                    <b style={{ width: "96%" }} />
                  </i>
                </div>
              </div>
            </div>
          </div>
        </article>

        <article className={styles.stagePanel}>
          <div className={styles.stagePanelLabel}>Ornek akis</div>
          <div className={styles.scheduleCard}>
            <span className={styles.scheduleBadge}>Bugun</span>
            <strong>WhatsApp support handoff</strong>
            <p>Kullanici AI ile baslar, gerekirse ayni konusma icinde canli ekibe gecer.</p>
            <div className={styles.tagList}>
              <span>Telefon</span>
              <span>WhatsApp</span>
              <span>Email</span>
            </div>
          </div>
          <div className={styles.miniLog}>
            <i />
            <span>Operasyon loglari ve audit trail ayni panelde gorunur.</span>
          </div>
        </article>
      </div>
    </div>
  );
}

function Breadcrumbs({
  items
}: {
  items: Array<{ label: string; href?: string }>;
}) {
  return (
    <div className={styles.breadcrumbs}>
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`}>
          {item.href ? <a href={item.href}>{item.label}</a> : <strong>{item.label}</strong>}
          {index < items.length - 1 ? <i>/</i> : null}
        </span>
      ))}
    </div>
  );
}

function ArticleCard({ article }: { article: PublicBlogArticle }) {
  return (
    <article className={styles.card}>
      <span className={styles.cardEyebrow}>{article.category}</span>
      <h3>{article.title}</h3>
      <p>{article.excerpt}</p>
      <div className={styles.articleMeta}>
        <span>{article.date}</span>
        <span>{article.readTime}</span>
      </div>
      <a href={`/blog/${article.slug}`} className={styles.inlineLink}>
        Yaziyi oku
      </a>
    </article>
  );
}

function MockContactForm({
  title,
  body,
  submitLabel
}: {
  title: string;
  body: string;
  submitLabel: string;
}) {
  return (
    <div className={styles.formCard}>
      <span className={styles.eyebrow}>Form</span>
      <h3>{title}</h3>
      <p>{body}</p>

      <div className={styles.formGrid}>
        <label className={styles.field}>
          <span>Ad Soyad</span>
          <input type="text" placeholder="Orn: Nurettin Erzen" />
        </label>
        <label className={styles.field}>
          <span>E-posta</span>
          <input type="email" placeholder="ornek@sirket.com" />
        </label>
        <label className={styles.field}>
          <span>Sirket</span>
          <input type="text" placeholder="Sirket adi" />
        </label>
        <label className={styles.field}>
          <span>Rol / Ekip</span>
          <input type="text" placeholder="Operasyon, destek, kurucu..." />
        </label>
        <label className={cn(styles.field, styles.fieldWide)}>
          <span>Mesaj</span>
          <textarea rows={5} placeholder="Ihtiyacinizi ve baglamak istediginiz kanallari yazin." />
        </label>
      </div>

      <button type="button" className={cn(styles.button, styles.buttonPrimary, styles.buttonBlock)}>
        <span>{submitLabel}</span>
        <span aria-hidden="true">-&gt;</span>
      </button>
    </div>
  );
}

function Timeline({ items }: { items: PublicTimelineEntry[] }) {
  return (
    <div className={styles.timeline}>
      {items.map((entry) => (
        <article key={`${entry.date}-${entry.title}`} className={styles.timelineItem}>
          <div className={styles.timelineMeta}>
            <span>{entry.date}</span>
            {entry.version ? <strong>{entry.version}</strong> : null}
          </div>
          <div className={styles.timelineCard}>
            <h3>{entry.title}</h3>
            <p>{entry.body}</p>
            <div className={styles.bulletList}>
              {entry.items.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function LegalSections({ sections }: { sections: PublicLegalSection[] }) {
  return (
    <div className={styles.legalList}>
      {sections.map((section) => (
        <article key={section.title} className={styles.legalCard}>
          <h3>{section.title}</h3>
          <p>{section.body}</p>
        </article>
      ))}
    </div>
  );
}

function DocsEndpoints() {
  const endpoints = [
    {
      method: "POST",
      path: "/v1/messages",
      body: "Kanallardan gelen mesaji isler ve AI yanit akisini baslatir."
    },
    {
      method: "GET",
      path: "/v1/conversations",
      body: "Konusmalari, durumlari ve handoff bilgilerini listeler."
    },
    {
      method: "POST",
      path: "/v1/webhooks",
      body: "Harici sistem olaylarini alip operasyon akisini tetikler."
    }
  ];

  return (
    <div className={styles.docsGrid}>
      <div className={styles.codeCard}>
        <span className={styles.cardEyebrow}>Quickstart</span>
        <h3>API anahtariyla dakikalar icinde baglanin.</h3>
        <pre className={styles.codeBlock}>
          <code>{`curl -X POST https://api.telyx.ai/v1/messages \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "channel": "whatsapp",
    "customerId": "cus_123",
    "message": "Siparisim nerede?"
  }'`}</code>
        </pre>
      </div>

      <div className={styles.endpointList}>
        {endpoints.map((endpoint) => (
          <article key={endpoint.path} className={styles.endpointCard}>
            <div className={styles.endpointMeta}>
              <span>{endpoint.method}</span>
              <strong>{endpoint.path}</strong>
            </div>
            <p>{endpoint.body}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function SolutionWorkflow({ solution }: { solution: PublicSolution }) {
  const workflow = [
    {
      step: "01",
      title: "Bilgiyi bagla",
      body: `${solution.label} operasyonunda sik tekrar eden sorular, veri kaynaklari ve kurallar baglanir.`
    },
    {
      step: "02",
      title: "Kanallari ac",
      body: `${solution.channels.join(", ")} kanallarinda ayni AI davranisi aktif edilir.`
    },
    {
      step: "03",
      title: "AI yanitlasin",
      body: "Kullanici niyeti algilanir, mevcut veriye gore aksiyon alinur ve gerekirse temsilciye devir olur."
    },
    {
      step: "04",
      title: "Performansi olc",
      body: "Cozum orani, handoff hizi ve memnuniyet verileri operasyon paneline duser."
    }
  ];

  return <StepsGrid steps={workflow} />;
}

export function PublicHomePage() {
  return (
    <PublicSiteFrame>
      {/* ═══ Hero ═══ */}
      <section className={styles.heroSection}>
        <div className={cn(styles.shell, styles.heroGrid)}>
          <div className={styles.heroCopy}>
            <span className={styles.heroKicker}>Telefon. WhatsApp. Chat. Email.</span>
            <h1>Tek AI, tum kanallar.</h1>
            <p>
              Musterileriniz hangi kanaldan ulasirsa ulassin ayni hiz, ayni kalite ve ayni
              profesyonellikle karsilanir. {SITE_BRAND} ile 7/24 kesintisiz musteri deneyimi
              sunun.
            </p>
            <div className={styles.heroActions}>
              <ActionLink action={{ label: "Ucretsiz Deneyin", href: "/auth/signup" }} />
              <ActionLink
                action={{ label: "Nasil calisir?", href: "#workflow", tone: "secondary" }}
                tone="secondary"
              />
            </div>
          </div>

          <ProductStage />
        </div>
      </section>

      {/* ═══ Manifesto / Statement ═══ */}
      <section className={styles.section}>
        <div className={cn(styles.shell, styles.statementCard)}>
          <span className={styles.eyebrow}>Manifesto</span>
          <p className={styles.statement}>
            Musteri hangi kanaldan gelirse gelsin ayni hafiza, ayni ton ve ayni operasyon
            sahiplenmesiyle karsilanmali. {SITE_BRAND}, bu fikri urunun merkezine yerlestirdi.
          </p>
        </div>
      </section>

      {/* ═══ Social proof / stats ═══ */}
      <section className={styles.section} id="impact">
        <div className={styles.shell}>
          <SectionHeader
            eyebrow="Rakamlar"
            title="Sonuclari olcun, farki gorun"
            subtitle="Musterilerimizin gercek operasyon verileriyle kanitlanan performans."
            align="center"
          />
          <StatsGrid items={PUBLIC_HOME_PROOF} columns={3} />
        </div>
      </section>

      {/* ═══ Channels ═══ */}
      <section className={cn(styles.section, styles.sectionMuted)} id="channels">
        <div className={styles.shell}>
          <SectionHeader
            eyebrow="Kanallar"
            title="Her temas noktasinda ayni deneyim"
            subtitle="Telefon, WhatsApp, web chat ve email uzerinden gelen tum talepler tek AI katmaniyla yonetilir."
          />
          <CardGrid cards={PUBLIC_HOME_CHANNELS} columns={4} />
        </div>
      </section>

      {/* ═══ Workflow / How it works ═══ */}
      <section className={styles.section} id="workflow">
        <div className={styles.shell}>
          <SectionHeader
            eyebrow="Nasil Calisir"
            title="Dort adimda devreye alin"
            subtitle="Isletmenizi tanitin, kanallari baglayin, AI devreye girsin, performansi izleyin."
            align="center"
          />
          <StepsGrid steps={PUBLIC_HOME_STEPS} />
        </div>
      </section>

      {/* ═══ Features / Operations ═══ */}
      <section className={cn(styles.section, styles.sectionMuted)}>
        <div className={styles.shell}>
          <SectionHeader
            eyebrow="Ozellikler"
            title="Dashboard, entegrasyon ve guvenlik tek catida"
            subtitle="Operasyonunuzu uctan uca yonetin, performansinizi anlik takip edin."
          />
          <CardGrid cards={PUBLIC_FEATURE_OPERATIONS} />
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section className={styles.section}>
        <div className={styles.shell}>
          <SectionHeader
            eyebrow="Sik Sorulan Sorular"
            title="Merak edilenleri yani&shy;tladik"
            subtitle="Baslangic, entegrasyon ve operasyon hakkinda en sik gelen sorular."
            align="center"
          />
          <FAQBlock items={PUBLIC_FAQ} />
        </div>
      </section>

      {/* ═══ Final CTA ═══ */}
      <CTASection
        title="Musterilerinize hak ettikleri deneyimi sunun"
        body="Ucretsiz deneme ile baslayip, dakikalar icinde ilk AI asistanlarinizi devreye alin."
      />
    </PublicSiteFrame>
  );
}

export function PublicFeaturesPage() {
  return (
    <PublicSiteFrame activeHref="/features">
      {/* ═══ Hero ═══ */}
      <section className={styles.heroSectionSlim}>
        <div className={styles.shell}>
          <SectionHeader
            eyebrow="Guclu Ozellikler"
            title="Isletmenizi guclendirecek AI yetenekleri"
            subtitle="Telefon, WhatsApp, web chat ve email kanallarini tek AI katmaniyla yonetin. Hizli kurulum, derin entegrasyonlar ve olceklenebilir otomasyon."
            align="center"
          />
          <div className={styles.centerActions}>
            {PUBLIC_FEATURE_HERO_ACTIONS.map((action) => (
              <ActionLink key={action.href} action={action} tone={action.tone} />
            ))}
          </div>
        </div>
      </section>

      {/* ═══ Feature Cards - Bento Grid ═══ */}
      <section className={styles.section} id="feature-groups">
        <div className={styles.shell}>
          <SectionHeader
            eyebrow="Cekirdek Yetenekler"
            title="Her kanali kapsayan AI ozellikleri"
            subtitle="Cok kanalli iletisim, akilli asistan, e-ticaret entegrasyonlari ve gercek zamanli izleme tek platformda."
          />
          <CardGrid cards={PUBLIC_FEATURE_GROUPS.slice(0, 2)} columns={2} />
          <CardGrid cards={PUBLIC_FEATURE_GROUPS.slice(2)} columns={4} />
        </div>
      </section>

      {/* ═══ Deep Dive - Operations ═══ */}
      <section className={cn(styles.section, styles.sectionMuted)}>
        <div className={styles.shell}>
          <SectionHeader
            eyebrow="Derinlemesine Inceleme"
            title="Operasyon gorunurlugu ve yonetim araclari"
            subtitle="Dashboard, guvenlik ve entegrasyon katmanlariyla ekibiniz ve yoneticileriniz ayni veriden karar verir."
            align="center"
          />
          <CardGrid cards={PUBLIC_FEATURE_OPERATIONS} />
        </div>
      </section>

      {/* ═══ Easy Setup - Timeline ═══ */}
      <section className={styles.section}>
        <div className={styles.shell}>
          <SectionHeader
            eyebrow="Kolay Kurulum"
            title="Dakikalar icinde yayina alin"
            subtitle="Dort adimda AI asistaninizi kurun ve tum kanallarinizda canli hizmete baslayin."
            align="center"
          />
          <StepsGrid steps={PUBLIC_HOME_STEPS} />
        </div>
      </section>

      {/* ═══ Sector Solutions ═══ */}
      <section className={cn(styles.section, styles.sectionMuted)}>
        <div className={styles.shell}>
          <SectionHeader
            eyebrow="Sektorel Cozumler"
            title="Her sektore ozel hazir AI akislari"
            subtitle="E-ticaret, restoran, salon ve musteri destegi icin optimize edilmis cozumler."
          />
          <CardGrid
            cards={PUBLIC_SOLUTIONS.map((solution) => ({
              title: solution.title,
              body: solution.shortDescription,
              bullets: solution.channels,
              href: `/solutions/${solution.slug}`,
              actionLabel: "Cozumu incele"
            }))}
            columns={2}
          />
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section className={styles.section}>
        <div className={styles.shell}>
          <SectionHeader
            eyebrow="Sik Sorulan Sorular"
            title="Merak edilenler"
            subtitle="Ozellikler, entegrasyon ve kullanim hakkinda en cok sorulan sorular."
            align="center"
          />
          <FAQBlock items={PUBLIC_FAQ} />
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <CTASection
        title="AI ile musteri deneyiminizi donusturun"
        body="Tum ozelliklerimizi ucretsiz deneyin. Kurulum dakikalar icinde tamamlanir, teknik bilgi gerekmez."
      />
    </PublicSiteFrame>
  );
}

export function PublicSolutionsPage() {
  return (
    <PublicSiteFrame activeHref="/solutions">
      {/* ═══ Hero ═══ */}
      <section className={styles.heroSectionSlim}>
        <div className={styles.shell}>
          <SectionHeader
            eyebrow="Sektorel AI Cozumleri"
            title="Sektorunuze ozel AI asistan"
            subtitle="E-ticaret, restoran, salon ve musteri destegi icin ozel olarak tasarlanmis hazir AI akislari ile hemen baslayabilirsiniz."
            align="center"
          />
          <div className={styles.centerActions}>
            <ActionLink action={{ label: "Cozumleri Kesfedin", href: "#solutions-grid" }} />
            <ActionLink action={{ label: "Bize Ulasin", href: "/contact", tone: "secondary" }} />
          </div>
        </div>
      </section>

      {/* ═══ Stats Bar ═══ */}
      <section className={cn(styles.section, styles.sectionMuted)}>
        <div className={styles.shell}>
          <StatsGrid items={PUBLIC_SOLUTIONS_STATS} columns={4} />
        </div>
      </section>

      {/* ═══ Solutions Grid ═══ */}
      <section className={styles.section} id="solutions-grid">
        <div className={styles.shell}>
          <SectionHeader
            eyebrow="Cozumlerimiz"
            title="Sektorunuzu secin, hemen baslayin"
            subtitle="Her cozum, sektorun ihtiyaclarina ozel AI akislari, entegrasyonlar ve kanal destegiyle donatildi."
            align="center"
          />
          <CardGrid
            cards={PUBLIC_SOLUTIONS.map((solution) => ({
              title: solution.title,
              body: solution.shortDescription,
              bullets: solution.useCases,
              href: `/solutions/${solution.slug}`,
              actionLabel: "Cozumu incele"
            }))}
            columns={2}
          />
        </div>
      </section>

      {/* ═══ Advantages Grid ═══ */}
      <section className={cn(styles.section, styles.sectionMuted)}>
        <div className={styles.shell}>
          <SectionHeader
            eyebrow="Neden Telyx?"
            title="Hizli kurulum, genis kanal kapsami, tam uyumluluk"
            subtitle="Sektorden bagimsiz olarak her isletmeye deger katan temel avantajlar."
            align="center"
          />
          <CardGrid cards={PUBLIC_SOLUTIONS_ADVANTAGES} columns={4} />
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section className={styles.section}>
        <div className={styles.shell}>
          <SectionHeader
            eyebrow="Sik Sorulan Sorular"
            title="Karar oncesi merak edilenler"
            subtitle="Cozumler, entegrasyon sureci ve fiyatlandirma hakkinda en sik sorulan sorular."
            align="center"
          />
          <FAQBlock items={PUBLIC_FAQ} />
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <CTASection
        title="Sektorunuze ozel AI cozumunu hemen deneyin"
        body="Listede olsun ya da olmasin, isletmenize uygun AI akisini birlikte tasarlayalim."
        primary={{ label: "Bize Ulasin", href: "/contact" }}
        secondary={{ label: "Demo Talep Edin", href: "/waitlist", tone: "secondary" }}
      />
    </PublicSiteFrame>
  );
}

export function PublicSolutionDetailPage({ slug }: { slug: string }) {
  const solution = getSolutionBySlug(slug);

  if (!solution) {
    return null;
  }

  return (
    <PublicSiteFrame activeHref="/solutions">
      <section className={styles.heroSection}>
        <div className={cn(styles.shell, styles.solutionHeroGrid)}>
          <div>
            <Breadcrumbs
              items={[
                { label: "Ana Sayfa", href: "/" },
                { label: "Cozumler", href: "/solutions" },
                { label: solution.label }
              ]}
            />
            <span className={styles.heroKicker}>{solution.label}</span>
            <h1 className={styles.solutionTitle}>{solution.title}</h1>
            <p className={styles.solutionIntro}>{solution.intro}</p>
            <div className={styles.heroActions}>
              <ActionLink action={{ label: "Demo Talep Edin", href: "/waitlist" }} />
              <ActionLink
                action={{ label: "Fiyatlari Incele", href: "/pricing", tone: "secondary" }}
                tone="secondary"
              />
            </div>
          </div>

          <div className={styles.solutionShowcase}>
            <div className={styles.showcaseCard}>
              <span className={styles.cardEyebrow}>Kullanim Senaryolari</span>
              <h3>{solution.shortDescription}</h3>
              <div className={styles.bulletList}>
                {solution.useCases.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </div>
            <div className={styles.showcaseStats}>
              {PUBLIC_SOLUTIONS_STATS.slice(0, 3).map((item) => (
                <div key={item.label} className={styles.showcaseStat}>
                  <strong>{item.value}</strong>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.shell}>
          <SectionHeader
            eyebrow="Nasil Calisir?"
            title={`${solution.label} operasyonuna uygun kurulum akisi`}
            subtitle="Detail sayfalarinda tekrar eden bilgi mimarisini route bazli veriyle dolduruyoruz."
          />
          <SolutionWorkflow solution={solution} />
        </div>
      </section>

      <section className={cn(styles.section, styles.sectionMuted)}>
        <div className={styles.shell}>
          <SectionHeader
            eyebrow="Kullanim Senaryolari"
            title="Saha gercegine yakin ornek akislar"
            subtitle="Telyx solution detaylarindaki use-case bolumunu bullet kartlarla yeniden kurduk."
          />
          <CardGrid
            cards={solution.useCases.map((item, index) => ({
              title: `Senaryo ${index + 1}`,
              body: item
            }))}
            columns={3}
          />
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.shell}>
          <SectionHeader
            eyebrow={`${solution.label} Icin One Cikanlar`}
            title="Operasyonun kritik avantajlari"
            subtitle="Highlight listesini landing sayfasindaki premium kart sistemine yerlestirdik."
          />
          <CardGrid
            cards={solution.highlights.map((item) => ({
              title: item,
              body: `${solution.label} ekibinin karar hizini ve kanal tutarliligini yukselten temel avantaji temsil eder.`
            }))}
            columns={2}
          />
        </div>
      </section>

      <section className={cn(styles.section, styles.sectionMuted)}>
        <div className={styles.shell}>
          <SectionHeader
            eyebrow="Tum Kanallardan Erisim"
            title="Ayni urun dili tum temas noktalarina yayiliyor"
            subtitle="Channel cards her solution detail sayfasinda tekrarlanacak sekilde reusable kuruldu."
          />
          <CardGrid
            cards={solution.channels.map((channel) => ({
              title: channel,
              body: `${solution.label} akisi ${channel} kanalinda ayni operasyon mantigi ile calisir.`
            }))}
            columns={4}
          />
        </div>
      </section>

      <CTASection title={solution.ctaTitle} body={solution.ctaBody} />
    </PublicSiteFrame>
  );
}

export function PublicPricingPage() {
  return (
    <PublicSiteFrame activeHref="/pricing">
      {/* ═══ Hero ═══ */}
      <section className={styles.heroSectionSlim}>
        <div className={styles.shell}>
          <SectionHeader
            eyebrow="Seffaf Fiyatlandirma"
            title="Ihtiyaciniza uygun plani secin"
            subtitle="Ucretsiz deneme ile baslayip, buyudukce olceklendirin. Gizli ucret yok, surpriz yok."
            align="center"
          />
          <div className={styles.centerActions}>
            <span className={styles.heroKicker}>
              15 dakika ucretsiz deneme &mdash; Kredi karti gerekmez
            </span>
          </div>
        </div>
      </section>

      {/* ═══ Plan cards ═══ */}
      <section className={styles.section}>
        <div className={styles.shell}>
          <div className={styles.pricingGrid}>
            {PUBLIC_PRICING_PLANS.map((plan) => (
              <article key={plan.title} className={cn(styles.card, styles.pricingCard)}>
                {plan.badge ? <span className={styles.cardBadge}>{plan.badge}</span> : null}
                <h3>{plan.title}</h3>
                <div className={styles.cardMeta}>{plan.meta}</div>
                <p>{plan.body}</p>
                <div className={styles.bulletList}>
                  {plan.bullets?.map((bullet) => (
                    <span key={bullet}>&#10003; {bullet}</span>
                  ))}
                </div>
                {plan.href && plan.actionLabel ? (
                  <ActionLink action={{ label: plan.actionLabel, href: plan.href }} fullWidth />
                ) : null}
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ Pay As You Go ═══ */}
      <section className={cn(styles.section, styles.sectionMuted)}>
        <div className={styles.shell}>
          <SectionHeader
            eyebrow="Esnek Kullanim"
            title="Kullandikca Ode"
            subtitle="Aylik taahhut yok. Ses dakikalari ve yazili etkilesimler kullanim bakiyesinden duser."
            align="center"
          />
          <div className={styles.paygLayout}>
            <article className={cn(styles.card, styles.paygCard)}>
              <div className={styles.cardMeta}>{PUBLIC_PAY_AS_YOU_GO.meta}</div>
              <p>{PUBLIC_PAY_AS_YOU_GO.body}</p>
              <div className={styles.bulletList}>
                {PUBLIC_PAY_AS_YOU_GO.bullets?.map((bullet) => (
                  <span key={bullet}>&#10003; {bullet}</span>
                ))}
              </div>
              {PUBLIC_PAY_AS_YOU_GO.href && PUBLIC_PAY_AS_YOU_GO.actionLabel ? (
                <ActionLink
                  action={{
                    label: PUBLIC_PAY_AS_YOU_GO.actionLabel,
                    href: PUBLIC_PAY_AS_YOU_GO.href
                  }}
                  fullWidth
                />
              ) : null}
            </article>

            <article className={styles.card}>
              <span className={styles.cardEyebrow}>Paket asim detaylari</span>
              <h3>Limit sonrasi davranis net ve onceden bilinen kurallara dayanir.</h3>
              <p>
                Plan limitleri asildiktan sonra nasil ucretlendirildiginizi acikca gorun.
              </p>
              <div className={styles.bulletList}>
                <span>&#10003; Dahil kullanim once tuketilir</span>
                <span>&#10003; Ek paket veya kullandikca ode modeli devreye girer</span>
                <span>&#10003; Ses dakikasi ve yazili etkilesim ayri izlenir</span>
                <span>&#10003; Kurumsalda ozel SLA ve destek seviyeleri eklenir</span>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section className={styles.section}>
        <div className={styles.shell}>
          <SectionHeader
            eyebrow="Sik Sorulan Sorular"
            title="Fiyatlandirma hakkinda merak edilenler"
            subtitle="Karar vermeden once en sik gelen sorulara goz atin."
            align="center"
          />
          <FAQBlock items={PUBLIC_FAQ} />
        </div>
      </section>

      {/* ═══ Final CTA ═══ */}
      <CTASection
        title="Hangi plan size uygun, birlikte belirleyelim"
        body="Ucretsiz demo ile baslayip, ihtiyaciniza gore dogru paketi secin."
        primary={{ label: "Demo Talep Edin", href: "/waitlist" }}
        secondary={{ label: "Iletisime Gecin", href: "/contact", tone: "secondary" }}
      />
    </PublicSiteFrame>
  );
}

export function PublicIntegrationsPage() {
  return (
    <PublicSiteFrame>
      <section className={styles.heroSectionSlim}>
        <div className={styles.shell}>
          <SectionHeader
            eyebrow="Entegrasyonlar"
            title="Kategori bazli entegrasyon sayfasi da ayni kurguyla tasindi"
            subtitle="Iletisim, e-ticaret, CRM, planlama ve veri entegrasyonlari ayri bloklar halinde yer aliyor."
            align="center"
          />
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.shell}>
          <div className={styles.integrationGroups}>
            {PUBLIC_INTEGRATION_GROUPS.map((group) => (
              <section key={group.title} className={styles.integrationGroup}>
                <h2>{group.title}</h2>
                <CardGrid cards={group.items} columns={3} />
              </section>
            ))}
          </div>
        </div>
      </section>

      <CTASection
        title="Harici sistemlerinizi de bu public hikayeye dahil edebiliriz"
        body="Yeni connector gruplari eklemek icin yalnizca veri katmanina yeni kartlar girmeniz yeterli."
      />
    </PublicSiteFrame>
  );
}

export function PublicBlogIndexPage() {
  return (
    <PublicSiteFrame activeHref="/blog">
      <section className={styles.heroSectionSlim}>
        <div className={styles.shell}>
          <SectionHeader
            eyebrow="Telyx Blog"
            title="Blog index, article detail ve related content akislariyla birlikte eklendi"
            subtitle="Blog sayfalarinin public alanini birebir genisletebilmek icin tum yazilar veri katmanina tasindi."
            align="center"
          />
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.shell}>
          <div className={styles.articleGrid}>
            {PUBLIC_BLOG_ARTICLES.map((article) => (
              <ArticleCard key={article.slug} article={article} />
            ))}
          </div>
        </div>
      </section>

      <section className={cn(styles.section, styles.sectionMuted)}>
        <div className={cn(styles.shell, styles.newsletterBand)}>
          <div>
            <span className={styles.eyebrow}>Yeni iceriklerden haberdar olun</span>
            <h2 className={styles.ctaTitle}>Public blog yapisi artik bu projede de hazir.</h2>
            <p className={styles.ctaBody}>
              Icerikleri sonra degistirecek olsak bile kart yapilari, detail layout ve related
              content deneyimi tamamlandi.
            </p>
          </div>
          <div className={styles.newsletterForm}>
            <input type="email" placeholder="E-posta adresiniz" />
            <button type="button" className={cn(styles.button, styles.buttonPrimary)}>
              <span>Abone Ol</span>
              <span aria-hidden="true">-&gt;</span>
            </button>
          </div>
        </div>
      </section>
    </PublicSiteFrame>
  );
}

export function PublicBlogArticlePage({ slug }: { slug: string }) {
  const article = getBlogArticleBySlug(slug);

  if (!article) {
    return null;
  }

  const relatedArticles = article.relatedSlugs
    .map((relatedSlug) => getBlogArticleBySlug(relatedSlug))
    .filter((entry): entry is PublicBlogArticle => Boolean(entry));

  return (
    <PublicSiteFrame activeHref="/blog">
      <section className={styles.heroSection}>
        <div className={cn(styles.shell, styles.articleHero)}>
          <Breadcrumbs
            items={[
              { label: "Ana Sayfa", href: "/" },
              { label: "Blog", href: "/blog" },
              { label: article.title }
            ]}
          />
          <span className={styles.heroKicker}>{article.category}</span>
          <h1 className={styles.articleTitle}>{article.title}</h1>
          <div className={styles.articleMetaLarge}>
            <span>{article.date}</span>
            <span>{article.readTime} okuma</span>
          </div>
          <p className={styles.articleLead}>{article.excerpt}</p>
        </div>
      </section>

      <section className={styles.section}>
        <div className={cn(styles.shell, styles.articleLayout)}>
          <div className={styles.articleContent}>
            {article.sections.map((section) => (
              <article key={section.title} className={styles.articleSection}>
                <h2>{section.title}</h2>
                <p>{section.body}</p>
              </article>
            ))}
          </div>

          <aside className={styles.articleAside}>
            <div className={styles.card}>
              <span className={styles.cardEyebrow}>Yazi Bilgisi</span>
              <h3>{article.category}</h3>
              <div className={styles.bulletList}>
                <span>{article.date}</span>
                <span>{article.readTime}</span>
                <span>Public content migration</span>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className={cn(styles.section, styles.sectionMuted)}>
        <div className={styles.shell}>
          <SectionHeader
            eyebrow="Ilgili Yazilar"
            title="Detail sayfasindan yeni icerige dogal gecis"
            subtitle="Related article grid yapisi blog detaylarini daha derli toplu kapatir."
          />
          <div className={styles.articleGrid}>
            {relatedArticles.map((relatedArticle) => (
              <ArticleCard key={relatedArticle.slug} article={relatedArticle} />
            ))}
          </div>
        </div>
      </section>

      <CTASection
        title="Blog detay sayfalari da public siteye tasindi"
        body="Siradaki turda makale iceriklerini bu urune ozgu konu basliklariyla degistirebiliriz."
      />
    </PublicSiteFrame>
  );
}

export function PublicHelpPage() {
  return (
    <PublicSiteFrame>
      <section className={styles.heroSectionSlim}>
        <div className={styles.shell}>
          <SectionHeader
            eyebrow="Sikca Sorulan Sorular"
            title="Help merkezi; hizli baslangic, populer konular ve SSS katmanlariyla hazir"
            subtitle="Public help yapisini ayrica ayirdik; boylece dokumantasyon ve blogdan farkli bir destek girisi sagliyor."
            align="center"
          />
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.shell}>
          <SectionHeader
            eyebrow="Hizli Baslangic"
            title="Ilk 4 adimla urun aktivasyonunu aciklayin"
          />
          <StepsGrid steps={PUBLIC_HELP_QUICKSTART} />
        </div>
      </section>

      <section className={cn(styles.section, styles.sectionMuted)}>
        <div className={styles.shell}>
          <SectionHeader
            eyebrow="Populer Konular"
            title="Yardim merkezine giren kullaniciyi dogru sayfaya yonlendirin"
          />
          <CardGrid cards={PUBLIC_HELP_TOPICS} columns={4} />
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.shell}>
          <SectionHeader eyebrow="SSS" title="Baska sorunuz mu var?" />
          <FAQBlock items={PUBLIC_FAQ} />
        </div>
      </section>

      <CTASection
        title="Yardim merkezini daha urune ozgu hale getirmek kolay"
        body="Bugun tum public iskeleti aldik; sonra bunu urun support akisiniza gore yeniden metinlestirebiliriz."
      />
    </PublicSiteFrame>
  );
}

export function PublicDocsApiPage() {
  return (
    <PublicSiteFrame>
      <section className={styles.heroSectionSlim}>
        <div className={styles.shell}>
          <SectionHeader
            eyebrow="API Dokumantasyonu"
            title="Developer-facing public page de route agacina eklendi"
            subtitle="Docs/API sayfasini; quickstart kod blogu, endpoint kartlari ve entegrasyon akisiyla birlikte olusturduk."
            align="center"
          />
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.shell}>
          <DocsEndpoints />
        </div>
      </section>

      <section className={cn(styles.section, styles.sectionMuted)}>
        <div className={styles.shell}>
          <CardGrid
            cards={[
              {
                title: "Authentication",
                body: "Bearer token ile kanal bazli olaylari guvenli sekilde kabul edin."
              },
              {
                title: "Webhook Delivery",
                body: "Handoff, cozum, basarisiz istek ve temsilci devri olaylarini takip edin."
              },
              {
                title: "Rate Limits",
                body: "Kanal bazli yuku korumak icin dakikalik ve saatlik limitler uygulanir."
              }
            ]}
          />
        </div>
      </section>

      <CTASection
        title="Public docs katmani da marketing siteyle ayni dilde calisiyor"
        body="Isterseniz bir sonraki turda gercek endpointlerinizi bu sayfaya yerlestirelim."
      />
    </PublicSiteFrame>
  );
}

export function PublicSecurityPage() {
  return (
    <PublicSiteFrame>
      <section className={styles.heroSectionSlim}>
        <div className={styles.shell}>
          <SectionHeader
            eyebrow="Verileriniz Guvende"
            title="Security sayfasi; veri guvenligi, yasal uyumluluk ve AI guvenligi katmanlariyla tamam"
            subtitle="Telyx security bilgisini ayni premium public tasarim diliyle bu projeye aktardik."
            align="center"
          />
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.shell}>
          <CardGrid cards={PUBLIC_SECURITY_GROUPS} columns={2} />
        </div>
      </section>

      <CTASection
        title="Guvenlik ile ilgili sorularinizi public site uzerinden de toplayabilirsiniz"
        body="Contact ve waitlist sayfalarini security CTA'lariyla birlestirecek temel altyapi da hazir."
        primary={{ label: "Iletisime Gecin", href: "/contact" }}
        secondary={{ label: "Demo Talep Edin", href: "/waitlist", tone: "secondary" }}
      />
    </PublicSiteFrame>
  );
}

export function PublicAboutPage() {
  return (
    <PublicSiteFrame>
      {/* ═══ Hero ═══ */}
      <section className={styles.heroSectionSlim}>
        <div className={styles.shell}>
          <SectionHeader
            eyebrow="Hakkimizda"
            title="Yapay zekayi isletmelerin hizmetine sunuyoruz"
            subtitle="Her buyuklukteki isletmenin 7/24 profesyonel ve tutarli musteri hizmeti sunabilmesini sagliyoruz."
            align="center"
          />
        </div>
      </section>

      {/* ═══ Stats Bar ═══ */}
      <section className={cn(styles.section, styles.sectionMuted)}>
        <div className={styles.shell}>
          <StatsGrid items={PUBLIC_ABOUT_STATS} columns={4} />
        </div>
      </section>

      {/* ═══ Our Story - Timeline Cards ═══ */}
      <section className={styles.section}>
        <div className={styles.shell}>
          <SectionHeader
            eyebrow="Hikayemiz"
            title="Nereden geldik, nereye gidiyoruz"
            subtitle="Farklı sektorlerde edinilen deneyim, yapay zeka ile birleserek Telyx'i ortaya cikardi."
            align="center"
          />
          <CardGrid cards={PUBLIC_ABOUT_STORY} columns={2} />
        </div>
      </section>

      {/* ═══ Team Grid ═══ */}
      <section className={cn(styles.section, styles.sectionMuted)}>
        <div className={styles.shell}>
          <SectionHeader
            eyebrow="Ekibimiz"
            title="Kucuk ama tutkulu bir ekip"
            subtitle="Her urun karari, her entegrasyon ve her iyilestirme musteri ihtiyaclarindan hareketle gelistiriliyor."
            align="center"
          />
          <CardGrid cards={PUBLIC_TEAM} columns={3} />
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <CTASection
        title="Hikayemizin bir parcasi olun"
        body="Isletmenizi AI ile donusturerek musterilerinize hak ettikleri deneyimi sunun."
        primary={{ label: "Demo Talep Edin", href: "/waitlist" }}
        secondary={{ label: "Iletisime Gecin", href: "/contact", tone: "secondary" }}
      />
    </PublicSiteFrame>
  );
}

export function PublicContactPage() {
  return (
    <PublicSiteFrame activeHref="/contact">
      {/* ═══ Hero ═══ */}
      <section className={styles.heroSectionSlim}>
        <div className={styles.shell}>
          <SectionHeader
            eyebrow="Iletisim"
            title="Size nasil yardimci olabiliriz?"
            subtitle="Sorularinizi iletin, ekibimiz en kisa surede size donecektir. Kurulum destegindenentegrasyon danismanligina kadar yaninizdayiz."
            align="center"
          />
        </div>
      </section>

      {/* ═══ Highlight Cards ═══ */}
      <section className={cn(styles.section, styles.sectionMuted)}>
        <div className={styles.shell}>
          <CardGrid cards={PUBLIC_CONTACT_TRUST} columns={4} />
        </div>
      </section>

      {/* ═══ Contact Form + Info ═══ */}
      <section className={styles.section}>
        <div className={cn(styles.shell, styles.contactLayout)}>
          <MockContactForm
            title="Bize Mesaj Gonderin"
            body="Formu doldurarak bize ulasin. Ekibimiz en kisa surede donus yapacaktir."
            submitLabel="Mesaji Gonder"
          />

          <div>
            {/* Trust Stats */}
            <div className={styles.compactStats}>
              {PUBLIC_CONTACT_METRICS.map((item) => (
                <div key={item.label} className={styles.compactStat}>
                  <strong>{item.value}</strong>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </PublicSiteFrame>
  );
}

export function PublicLegalPage({
  title,
  subtitle,
  sections
}: {
  title: string;
  subtitle: string;
  sections: PublicLegalSection[];
}) {
  return (
    <PublicSiteFrame>
      <section className={styles.heroSectionSlim}>
        <div className={styles.shell}>
          <SectionHeader eyebrow="Yasal" title={title} subtitle={subtitle} align="center" />
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.shell}>
          <LegalSections sections={sections} />
        </div>
      </section>
    </PublicSiteFrame>
  );
}

export function PublicPrivacyPage() {
  return (
    <PublicLegalPage
      title="Gizlilik Politikasi (Privacy Policy)"
      subtitle="Toplanan verilerden retention politikasina kadar tum public yasal bolumler kart yapisinda duzenlendi."
      sections={PUBLIC_PRIVACY_SECTIONS}
    />
  );
}

export function PublicTermsPage() {
  return (
    <PublicLegalPage
      title="Kullanim Kosullari (Terms of Service)"
      subtitle="Kullanim, planlar, entegrasyonlar ve sorumluluk sinirlari public legal layout ile eklendi."
      sections={PUBLIC_TERMS_SECTIONS}
    />
  );
}

export function PublicChangelogPage() {
  return (
    <PublicSiteFrame>
      <section className={styles.heroSectionSlim}>
        <div className={styles.shell}>
          <SectionHeader
            eyebrow="Neler Degisiyor?"
            title="Changelog zaman cizgisi artik public site agacinda"
            subtitle="Version history, release notes ve kapanis CTA'si ile public urun guncelleme sayfasi hazir."
            align="center"
          />
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.shell}>
          <Timeline items={PUBLIC_CHANGELOG} />
        </div>
      </section>

      <CTASection
        title="Gelistirme surecimizin bir parcasi olun"
        body="Changelog sayfasini product marketing yapisina dahil ettik. Sonraki adimda kendi release notlarinizla doldurabiliriz."
      />
    </PublicSiteFrame>
  );
}

export function PublicWaitlistPage() {
  return (
    <PublicSiteFrame>
      <section className={styles.heroSection}>
        <div className={cn(styles.shell, styles.contactLayout)}>
          <div>
            <SectionHeader
              eyebrow="Demo Talep Edin"
              title="Waitlist / demo talep sayfasi da ayni public tasarim sistemiyle eklendi"
              subtitle="Telyx demo talep akisini, guven kartlari ve sade bir form kompozisyonuyla bu projeye tasidik."
            />
            <StepsGrid
              steps={[
                { step: "01", title: "Ihtiyaci anlatin", body: "Hangi kanallari yoneteceginizi paylasin." },
                { step: "02", title: "Akisi tasarlayalim", body: "Operasyonunuza uygun demo senaryosunu kuralim." },
                { step: "03", title: "Canli gostereyim", body: "Public sayfalardan urun deneyimine gecelim." },
                { step: "04", title: "Karar verin", body: "Gerekirse icerigi ve fiyat yapisini uyarlayalim." }
              ]}
            />
          </div>

          <MockContactForm
            title="Demo formu"
            body="Bu form su an kopyalanmis public iskeletin parcasi. Sonraki adimda gercek submission akisini baglayabiliriz."
            submitLabel="Demo Iste"
          />
        </div>
      </section>
    </PublicSiteFrame>
  );
}
