import type { ReactNode } from "react";
import styles from "./public-site.module.css";
import { LandingHero } from "./landing-hero";
import { PublicLeadForm } from "./public-lead-form";
import { LanguagePill } from "./language-pill";
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

const SITE_BRAND = "Candit.ai";
const SITE_TAGLINE = "AI ile işe alımın geleceği.";

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
          <span className={styles.brandMark}>
            <img src="/brand/candit-mark.svg" alt="" aria-hidden="true" width="40" height="40" />
          </span>
          <span className={styles.brandCopy}>
            <strong>{SITE_BRAND}</strong>
            <span>AI destekli işe alım platformu</span>
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
          <LanguagePill />
          <a href="/auth/login" className={styles.headerTextAction}>
            Giriş Yap
          </a>
          <ActionLink action={{ label: "Ücretsiz Deneyin", href: "/auth/signup" }} />
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
              <span className={styles.brandMark}>
                <img src="/brand/candit-mark.svg" alt="" aria-hidden="true" width="40" height="40" />
              </span>
              <span className={styles.brandCopy}>
                <strong>{SITE_BRAND}</strong>
                <span>AI destekli işe alım platformu.</span>
              </span>
            </a>
            <p className={styles.footerCopy}>
              Ön eleme, kaynak bulma ve mülakat süreçlerini yapay zekâ ile otomatikleştirin.
              Doğru adayı daha hızlı bulun.
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
          <span>(c) 2026 {SITE_BRAND}. Tüm hakları saklıdır.</span>
          <div className={styles.footerBottomLinks}>
            <a href="/privacy">Gizlilik</a>
            <a href="/terms">Kullanım Koşulları</a>
            <a href="/contact">İletişim</a>
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
  primary = { label: "Hesap Oluştur", href: "/auth/signup" },
  secondary = { label: "Fiyatları İncele", href: "/pricing", tone: "secondary" }
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
          <span className={styles.eyebrow}>Hazır mısınız?</span>
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
          Sistem aktif
        </span>
      </div>

      <div className={styles.stageHeadline}>
        <div>
          <span className={styles.stageEyebrow}>Tek platform, tam kontrol</span>
          <h2>Tüm işe alım süreçleri tek panelde buluşur.</h2>
        </div>
        <div className={styles.stageScore}>
          <strong>%87</strong>
          <span>daha hızlı işe alım</span>
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
          <div className={styles.stagePanelLabel}>Modüller</div>
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
          <div className={styles.stagePanelLabel}>Performans metrikleri</div>
          <div className={styles.signalPanel}>
            <div className={styles.signalRing}>
              <span>7/24</span>
              <small>mülakat</small>
            </div>

            <div className={styles.signalBody}>
              <h3>Tek platform ile daha hızlı, daha doğru işe alım.</h3>
              <p>
                Ön eleme, AI mülakat ve değerlendirme süreçleri aynı akış içinde
                otomatik yönetilir.
              </p>
              <div className={styles.progressList}>
                <div>
                  <span>Değerlendirme doğruluğu</span>
                  <i>
                    <b style={{ width: "82%" }} />
                  </i>
                </div>
                <div>
                  <span>Süreç hızı</span>
                  <i>
                    <b style={{ width: "91%" }} />
                  </i>
                </div>
                <div>
                  <span>Aday memnuniyeti</span>
                  <i>
                    <b style={{ width: "96%" }} />
                  </i>
                </div>
              </div>
            </div>
          </div>
        </article>

        <article className={styles.stagePanel}>
          <div className={styles.stagePanelLabel}>Örnek akış</div>
          <div className={styles.scheduleCard}>
            <span className={styles.scheduleBadge}>Bugün</span>
            <strong>AI mülakat değerlendirmesi</strong>
            <p>Aday AI mülakat ile başlar, değerlendirme otomatik oluşturulur ve sonuçlar panele düşer.</p>
            <div className={styles.tagList}>
              <span>AI Mülakat</span>
              <span>Ön Eleme</span>
              <span>Analitik</span>
            </div>
          </div>
          <div className={styles.miniLog}>
            <i />
            <span>Tüm mülakat ve değerlendirme kayıtları tek panelde görünür.</span>
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
        Yazıyı oku
      </a>
    </article>
  );
}

function LeadCaptureForm({
  title,
  body,
  submitLabel,
  sourcePage,
  successTitle,
  successBody
}: {
  title: string;
  body: string;
  submitLabel: string;
  sourcePage: string;
  successTitle: string;
  successBody: string;
}) {
  return (
    <PublicLeadForm
      title={title}
      body={body}
      submitLabel={submitLabel}
      sourcePage={sourcePage}
      successTitle={successTitle}
      successBody={successBody}
    />
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
      body: "Kanallardan gelen mesajı işler ve AI yanıt akışını başlatır."
    },
    {
      method: "GET",
      path: "/v1/conversations",
      body: "Mülakatları, durumları ve değerlendirme bilgilerini listeler."
    },
    {
      method: "POST",
      path: "/v1/webhooks",
      body: "Harici sistem olaylarını alıp operasyon akışını tetikler."
    }
  ];

  return (
    <div className={styles.docsGrid}>
      <div className={styles.codeCard}>
        <span className={styles.cardEyebrow}>Hızlı Başlangıç</span>
        <h3>API anahtarıyla dakikalar içinde bağlanın.</h3>
        <pre className={styles.codeBlock}>
          <code>{`curl -X POST https://api.candit.ai/v1/messages \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "channel": "whatsapp",
    "customerId": "cus_123",
    "message": "Siparişim nerede?"
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
      title: "Pozisyonu tanımlayın",
      body: `${solution.label} sektörüne özel mülakat soruları ve değerlendirme kriterlerini belirleyin.`
    },
    {
      step: "02",
      title: "Araçları etkinleştirin",
      body: `${solution.channels.join(", ")} araçlarını aktif edin ve işe alım sürecinizi başlatın.`
    },
    {
      step: "03",
      title: "AI mülakat yaptırın",
      body: "Adaylar AI mülakat ile değerlendirilir, yanıtlar analiz edilir ve yetkinlik raporu oluşturulur."
    },
    {
      step: "04",
      title: "Sonuçları değerlendirin",
      body: "Mülakat tamamlanma, değerlendirme skoru ve karşılaştırmalı raporlarla en uygun adayı belirleyin."
    }
  ];

  return <StepsGrid steps={workflow} />;
}

export function PublicHomePage() {
  return (
    <PublicSiteFrame>
      <LandingHero />
    </PublicSiteFrame>
  );
}

export function PublicFeaturesPage() {
  /* Inline SVG icons for feature cards */
  const CheckSvg = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
  );
  const SparklesSvg = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" /><path d="M5 3v4" /><path d="M19 17v4" /><path d="M3 5h4" /><path d="M17 19h4" /></svg>
  );
  const ArrowRightSvg = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
  );

  /* Gradient classes mapped to feature groups */
  const featureGradients = [
    styles.ftGradBlue, styles.ftGradNavy,
    styles.ftGradDeep, styles.ftGradCyan, styles.ftGradReverse, styles.ftGradDark
  ];
  const operationGradients = [styles.ftGradCyan, styles.ftGradNavy, styles.ftGradDark];
  const stepGradients = [styles.ftGradNavy, styles.ftGradBlue, styles.ftGradDeep, styles.ftGradCyan];

  return (
    <PublicSiteFrame activeHref="/features">
      <div className={styles.ftPage}>
        {/* ═══ Hero with gradient blobs ═══ */}
        <section className={styles.ftHero}>
          <div className={styles.ftGlowBlob} style={{ width: 600, height: 600, top: -200, left: '8%', background: '#5046e5' }} aria-hidden="true" />
          <div className={styles.ftGlowBlob} style={{ width: 450, height: 450, top: -40, right: '5%', background: '#7c3aed' }} aria-hidden="true" />

          <div className={cn(styles.shell, styles.ftHeroInner)}>
            <span className={styles.ftBadgeShimmer}>
              <SparklesSvg />
              Güçlü Özellikler
            </span>
            <h1 className={styles.ftHeroTitle}>
              İşe alım sürecinizi güçlendirecek AI yetenekleri
            </h1>
            <p className={styles.ftHeroSubtitle}>
              AI mülakat, aday tarama, iş ilanı yönetimi ve analitik araçları tek platformda. Hızlı kurulum, derin entegrasyonlar ve ölçeklenebilir otomasyon.
            </p>
            <div className={styles.ftHeroActions}>
              <a href="/auth/signup" className={cn(styles.ftGlowBtn, styles.ftGlowBtnPrimary)}>
                Hemen Başlayın
              </a>
              <a href="#features-grid" className={cn(styles.ftGlowBtn, styles.ftGlowBtnOutline)}>
                Özellikleri Keşfedin
              </a>
            </div>
          </div>
        </section>

        {/* ═══ Feature Cards - Bento Grid with Mouse-Tracking Glow ═══ */}
        <section className={styles.ftSection} id="features-grid">
          <div className={styles.shell}>
            <div>
              {/* Row 1: 2 big cards */}
              <div className={styles.ftBentoRow2}>
                {PUBLIC_FEATURE_GROUPS.slice(0, 2).map((feature, index) => (
                  <article key={feature.title} className={cn(styles.ftCard, styles.ftCardLg)}>
                    <div className={styles.ftCardInner}>
                      <div className={cn(styles.ftIcon, featureGradients[index])} />
                      <h3 className={cn(styles.ftCardTitle, styles.ftCardTitleLg)}>{feature.title}</h3>
                      <p className={styles.ftCardDesc}>{feature.body}</p>
                      {feature.bullets?.length ? (
                        <div className={styles.ftCheckList}>
                          {feature.bullets.map((item) => (
                            <div key={item} className={styles.ftCheckItem}>
                              <span className={styles.ftCheck}><CheckSvg /></span>
                              <span>{item}</span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>

              {/* Row 2: 4 smaller cards */}
              <div className={styles.ftBentoRow4}>
                {PUBLIC_FEATURE_GROUPS.slice(2).map((feature, index) => (
                  <article key={feature.title} className={cn(styles.ftCard, styles.ftCardSm)}>
                    <div className={styles.ftCardInner}>
                      <div className={cn(styles.ftIcon, featureGradients[index + 2])} />
                      <h3 className={styles.ftCardTitle}>{feature.title}</h3>
                      <p className={styles.ftCardDesc}>{feature.body}</p>
                      {feature.bullets?.length ? (
                        <div className={styles.ftCheckList}>
                          {feature.bullets.map((item) => (
                            <div key={item} className={styles.ftCheckItem}>
                              <span className={styles.ftCheck}><CheckSvg /></span>
                              <span>{item}</span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ═══ Deep Dive - Shimmer Top-Line Cards ═══ */}
        <section className={styles.ftSectionBg}>
          <div className={styles.ftGlowBlob} style={{ width: 500, height: 500, bottom: -100, left: '50%', marginLeft: -250, background: '#5046e5', opacity: 0.06 }} aria-hidden="true" />

          <div className={cn(styles.shell)} style={{ position: 'relative', zIndex: 10 }}>
            <div className={styles.ftSectionHeader}>
              <h2 className={styles.ftSectionTitle}>Operasyon görünürlüğü ve yönetim araçları</h2>
              <p className={styles.ftSectionSubtitle}>
                Dashboard, güvenlik ve entegrasyon katmanlarıyla ekibiniz ve yöneticileriniz aynı veriden karar verir.
              </p>
            </div>
            <div className={styles.ftDeepGrid}>
              {PUBLIC_FEATURE_OPERATIONS.map((op, index) => (
                <article key={op.title} className={styles.ftDeepCard}>
                  <div style={{ position: 'relative', zIndex: 10 }}>
                    <div className={cn(styles.ftIcon, operationGradients[index])} />
                    <h3 className={styles.ftCardTitle}>{op.title}</h3>
                    <p className={styles.ftCardDesc}>{op.body}</p>
                    {op.bullets?.length ? (
                      <div className={styles.ftCheckList}>
                        {op.bullets.map((item) => (
                          <div key={item} className={styles.ftCheckItem}>
                            <span className={styles.ftCheck}><CheckSvg /></span>
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ Easy Setup - Glowing Timeline ═══ */}
        <section className={styles.ftSection}>
          <div className={styles.shell}>
            <div className={styles.ftSectionHeader}>
              <h2 className={styles.ftSectionTitle}>Dakikalar içinde yayına alın</h2>
              <p className={styles.ftSectionSubtitle}>
                Dört adımda AI mülakat sisteminizi kurun ve işe alım süreçlerinizde canlı hizmete başlayın.
              </p>
            </div>
            <div className={styles.ftStepsGrid}>
              <div className={styles.ftConnector} aria-hidden="true" />
              {PUBLIC_HOME_STEPS.map((step, index) => (
                <div key={step.step} className={styles.ftStep}>
                  <div className={cn(styles.ftStepCircle, stepGradients[index % stepGradients.length])} />
                  <div className={styles.ftStepNumber}>{step.step}</div>
                  <h3 className={styles.ftStepTitle}>{step.title}</h3>
                  <p className={styles.ftStepDesc}>{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ Sector Solution Cards ═══ */}
        <section className={styles.ftSection}>
          <div className={styles.shell}>
            <div className={styles.ftSectionHeader}>
              <h2 className={styles.ftSectionTitle}>Her sektöre özel AI işe alım çözümleri</h2>
              <p className={styles.ftSectionSubtitle}>
                Teknoloji, perakende, sağlık, finans ve üretim sektörlerine özel mülakat akışları.
              </p>
            </div>
            <div className={styles.ftSolutionGrid}>
              {PUBLIC_SOLUTIONS.map((solution, index) => (
                <a key={solution.slug} href={`/solutions/${solution.slug}`} className={styles.ftSolutionCard}>
                  <div className={styles.ftSolutionCardInner}>
                    <div className={cn(styles.ftSolutionIcon, featureGradients[index % featureGradients.length])} />
                    <div style={{ flex: 1 }}>
                      <h3 className={styles.ftSolutionTitle}>{solution.title}</h3>
                      <p className={styles.ftSolutionDesc}>{solution.shortDescription}</p>
                      <span className={styles.ftSolutionLink}>
                        Çözümü incele <ArrowRightSvg />
                      </span>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ FAQ ═══ */}
        <section className={styles.ftSection}>
          <div className={styles.shell}>
            <div className={styles.ftSectionHeader}>
              <h2 className={styles.ftSectionTitle}>Merak edilenler</h2>
              <p className={styles.ftSectionSubtitle}>
                Özellikler, entegrasyon ve kullanım hakkında en çok sorulan sorular.
              </p>
            </div>
            <FAQBlock items={PUBLIC_FAQ} />
          </div>
        </section>

        {/* ═══ CTA - Glow Section ═══ */}
        <section className={styles.ftSection}>
          <div className={styles.shell}>
            <div className={styles.ftCta}>
              <div className={styles.ftCtaInner}>
                <h2 className={styles.ftCtaTitle}>AI ile işe alım deneyiminizi dönüştürün</h2>
                <p className={styles.ftCtaSubtitle}>
                  Tüm özelliklerimizi ücretsiz deneyin. Kurulum dakikalar içinde tamamlanır, teknik bilgi gerekmez.
                </p>
                <div className={styles.ftCtaActions}>
                  <a href="/auth/signup" className={cn(styles.ftGlowBtn, styles.ftCtaBtnWhite)}>
                    Hemen Başlayın
                  </a>
                  <a href="/contact" className={cn(styles.ftGlowBtn, styles.ftCtaBtnGhost)}>
                    Bize Ulaşın
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </PublicSiteFrame>
  );
}

export function PublicSolutionsPage() {
  const CheckSvg = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
  );
  const SparklesSvg = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" /><path d="M5 3v4" /><path d="M19 17v4" /><path d="M3 5h4" /><path d="M17 19h4" /></svg>
  );
  const ArrowRightSvg = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
  );

  const solutionGradients = [
    styles.ftGradBlue, styles.ftGradNavy, styles.ftGradCyan, styles.ftGradDeep
  ];
  const advantageGradients = [
    styles.ftGradCyan, styles.ftGradNavy, styles.ftGradBlue, styles.ftGradDeep
  ];

  return (
    <PublicSiteFrame activeHref="/solutions">
      <div className={styles.solPage}>
        {/* ═══ Hero ═══ */}
        <section className={styles.solHero}>
          <div className={styles.solGlowBlob} style={{ width: 384, height: 384, top: 80, left: '25%', background: '#5046e5' }} aria-hidden="true" />
          <div className={styles.solGlowBlob} style={{ width: 288, height: 288, bottom: 0, right: '25%', background: '#7c3aed' }} aria-hidden="true" />

          <div className={cn(styles.shell, styles.solHeroInner)}>
            <span className={styles.solBadge}>
              <SparklesSvg />
              Sektörel AI Çözümleri
            </span>
            <h1 className={styles.solHeroTitle}>
              Sektörünüze özel AI mülakat asistanı
            </h1>
            <p className={styles.solHeroSubtitle}>
              Teknoloji, perakende, sağlık, finans ve üretim sektörlerine özel AI mülakat ve ön eleme akışları ile hemen başlayın.
            </p>
            <div className={styles.solHeroActions}>
              <a href="#solutions-grid" className={cn(styles.solGlowBtn, styles.solGlowBtnPrimary)}>
                Çözümleri Keşfedin
              </a>
              <a href="/contact" className={cn(styles.solGlowBtn, styles.solGlowBtnOutline)}>
                Bize Ulaşın
              </a>
            </div>
          </div>
        </section>

        {/* ═══ Stats Bar (Animated) ═══ */}
        <section className={styles.solStatsBar}>
          <div className={styles.shell}>
            <div className={styles.solStatsGrid}>
              {PUBLIC_SOLUTIONS_STATS.map((stat) => (
                <div key={stat.label} className={styles.solStatItem}>
                  <div className={styles.solStatValue}>{stat.value}</div>
                  <div className={styles.solStatLabel}>{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ Solutions Grid ═══ */}
        <section className={styles.solSection} id="solutions-grid">
          <div className={styles.shell}>
            <div className={styles.solSectionHeader}>
              <h2 className={styles.solSectionTitle}>Sektörünüzü seçin, hemen başlayın</h2>
              <p className={styles.solSectionSubtitle}>
                Her çözüm, sektörün ihtiyaçlarına özel AI mülakat akışları, ön eleme kriterleri ve değerlendirme metrikleriyle donatıldı.
              </p>
            </div>
            <div className={styles.solGrid}>
              {PUBLIC_SOLUTIONS.map((solution, index) => (
                <a key={solution.slug} href={`/solutions/${solution.slug}`} className={styles.solCard}>
                  <div className={cn(styles.solCardBlur, solutionGradients[index % solutionGradients.length])} aria-hidden="true" />
                  <div className={styles.solCardContent}>
                    <div className={cn(styles.solCardIcon, solutionGradients[index % solutionGradients.length])} />
                    <h3 className={styles.solCardTitle}>{solution.title}</h3>
                    <p className={styles.solCardDesc}>{solution.shortDescription}</p>
                    <div className={styles.solCheckList}>
                      {solution.useCases.map((useCase) => (
                        <div key={useCase} className={styles.solCheckItem}>
                          <span className={styles.solCheck}><CheckSvg /></span>
                          <span>{useCase}</span>
                        </div>
                      ))}
                    </div>
                    <span className={styles.solCardCta}>
                      Çözümü incele
                      <ArrowRightSvg />
                    </span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ Advantages Bento Grid ═══ */}
        <section className={styles.solSectionMuted}>
          <div className={styles.shell}>
            <div className={styles.solSectionHeader}>
              <h2 className={styles.solSectionTitle}>Neden Candit.ai?</h2>
              <p className={styles.solSectionSubtitle}>
                Sektörden bağımsız olarak her işe alım ekibine değer katan temel avantajlar.
              </p>
            </div>
            <div className={styles.solBentoGrid}>
              {PUBLIC_SOLUTIONS_ADVANTAGES.map((advantage, index) => (
                <article key={advantage.title} className={styles.solBentoItem}>
                  <div className={styles.solBentoItemInner}>
                    <div className={cn(styles.solBentoIcon, advantageGradients[index % advantageGradients.length])} />
                    <h3 className={styles.solBentoTitle}>{advantage.title}</h3>
                    <p className={styles.solBentoDesc}>{advantage.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ FAQ ═══ */}
        <section className={styles.solSection}>
          <div className={styles.shell}>
            <div className={styles.solSectionHeader}>
              <h2 className={styles.solSectionTitle}>Karar öncesi merak edilenler</h2>
              <p className={styles.solSectionSubtitle}>
                Çözümler, entegrasyon süreci ve fiyatlandırma hakkında en sık sorulan sorular.
              </p>
            </div>
            <FAQBlock items={PUBLIC_FAQ} />
          </div>
        </section>

        {/* ═══ CTA ═══ */}
        <section className={styles.solSection}>
          <div className={styles.shell}>
            <div className={styles.solCta}>
              <div className={styles.solCtaInner}>
                <h2 className={styles.solCtaTitle}>Sektörünüze özel AI işe alım çözümünü deneyin</h2>
                <p className={styles.solCtaSubtitle}>
                  Listede olsun ya da olmasın, sektörünüze uygun mülakat ve ön eleme akışını birlikte tasarlayalım.
                </p>
                <div className={styles.solCtaActions}>
                  <a href="/contact" className={styles.solCtaBtnWhite}>
                    Bize Ulaşın
                  </a>
                  <a href="/auth/signup" className={styles.solCtaBtnGhost}>
                    Hesap Oluştur
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
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
                { label: "Çözümler", href: "/solutions" },
                { label: solution.label }
              ]}
            />
            <span className={styles.heroKicker}>{solution.label}</span>
            <h1 className={styles.solutionTitle}>{solution.title}</h1>
            <p className={styles.solutionIntro}>{solution.intro}</p>
            <div className={styles.heroActions}>
              <ActionLink action={{ label: "Hesap Oluştur", href: "/auth/signup" }} />
              <ActionLink
                action={{ label: "Fiyatları İncele", href: "/pricing", tone: "secondary" }}
                tone="secondary"
              />
            </div>
          </div>

          <div className={styles.solutionShowcase}>
            <div className={styles.showcaseCard}>
              <span className={styles.cardEyebrow}>Kullanım Senaryoları</span>
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
            eyebrow="Nasıl Çalışır?"
            title={`${solution.label} operasyonuna uygun kurulum akışı`}
            subtitle="Pozisyonu tanımlayın, adayları yönlendirin ve AI mülakatı başlatın. Her adım otomatik yönetilir."
          />
          <SolutionWorkflow solution={solution} />
        </div>
      </section>

      <section className={cn(styles.section, styles.sectionMuted)}>
        <div className={styles.shell}>
          <SectionHeader
            eyebrow="Kullanım Senaryoları"
            title="Saha gerçeğine yakın örnek akışlar"
            subtitle="Sektörünüze özel AI mülakat ve ön eleme senaryolarını inceleyin."
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
            eyebrow={`${solution.label} İçin Öne Çıkanlar`}
            title="Operasyonun kritik avantajları"
            subtitle="Bu sektördeki işe alım sürecinizi hızlandıran temel avantajlar."
          />
          <CardGrid
            cards={solution.highlights.map((item) => ({
              title: item,
              body: `${solution.label} sektöründe işe alım kalitesini ve hızını artıran temel avantajı temsil eder.`
            }))}
            columns={2}
          />
        </div>
      </section>

      <section className={cn(styles.section, styles.sectionMuted)}>
        <div className={styles.shell}>
          <SectionHeader
            eyebrow="Kullanılan Araçlar"
            title="İşe alım sürecinin her adımında AI desteği"
            subtitle="Candit'in temel araçları bu sektör çözümünde nasıl kullanılıyor?"
          />
          <CardGrid
            cards={solution.channels.map((channel) => ({
              title: channel,
              body: `${solution.label} sektöründe ${channel} aracı ile işe alım sürecinizi güçlendirin.`
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
  const OVERAGE_ROWS = [
    {
      channel: "Ek aday işleme",
      unit: "50 aday",
      rate: "1.099₺/paket",
      note: "Düşük hacimli ek ihtiyaçlarda hızlı kapasite artışı için kullanılır."
    },
    {
      channel: "Ek aday işleme",
      unit: "100 aday",
      rate: "1.999₺/paket",
      note: "Aday ön eleme kotası dolduğunda daha avantajlı geniş paket seçeneğidir."
    },
    {
      channel: "Ek AI mülakat",
      unit: "10 mülakat",
      rate: "1.199₺/paket",
      note: "Kısa süreli ek görüşme ihtiyacı için küçük mülakat paketi."
    },
    {
      channel: "Ek AI mülakat",
      unit: "25 mülakat",
      rate: "2.499₺/paket",
      note: "Dönem içinde daha yoğun AI mülakat kullanımı için daha avantajlı büyük paket seçeneğidir."
    }
  ];

  return (
    <PublicSiteFrame activeHref="/pricing">
      {/* ══ Hero ══ */}
      <section className={styles.prHero}>
        <div className={styles.prGlowBlob} style={{ width: 500, height: 500, top: -100, left: "10%" }} aria-hidden="true" />
        <div className={styles.prGlowBlobPurple} style={{ width: 400, height: 400, top: 50, right: "5%" }} aria-hidden="true" />

        <div className={cn(styles.shell, styles.prHeroInner)}>
          <span className={styles.prBadge}>
            <span className={styles.prBadgeDot} />
            Şeffaf Fiyatlandırma
          </span>
          <h1 className={styles.prHeroTitle}>
            İhtiyacınıza uygun planı seçin
          </h1>
          <p className={styles.prHeroSubtitle}>
            Ücretsiz deneme ile başlayıp, büyüdükçe ölçeklendirin. Gizli ücret yok, sürpriz yok.
          </p>
          <p className={styles.prHeroKicker}>
            Ücretsiz deneme &mdash; Kredi kartı gerekmez
          </p>
        </div>
      </section>

      {/* ══ Plan Cards ══ */}
      <section className={styles.prPlansSection}>
        <div className={styles.shell}>
          <div className={styles.prCardsGrid}>
            {PUBLIC_PRICING_PLANS.map((plan, i) => {
              const isPopular = plan.badge === "En Pop\u00FCler";
              const isEnterprise = plan.title === "Kurumsal";
              const isTrial = plan.title === "Deneme";

              return (
                <article
                  key={plan.title}
                  className={cn(styles.prPlanCard, isPopular && styles.prPlanCardPopular)}
                >
                  {/* Popular badge */}
                  {isPopular && (
                    <div className={styles.prPopularBadgeWrap}>
                      <span className={styles.prPopularBadge}>En Pop&uuml;ler</span>
                    </div>
                  )}

                  {/* Plan header */}
                  <div className={styles.prPlanHeader}>
                    <h3 className={styles.prPlanName}>{plan.title}</h3>
                    <p className={styles.prPlanDesc}>{plan.body}</p>

                    {/* Price */}
                    <div className={styles.prPriceBlock}>
                      {isTrial ? (
                        <span className={styles.prPriceFree}>&Uuml;cretsiz</span>
                      ) : isEnterprise ? (
                        <span className={styles.prPriceContact}>İletişime Geçin</span>
                      ) : (
                        <>
                          <span className={styles.prPriceAmount}>
                            {plan.meta
                              ? plan.meta.split("/")[0]?.split("•")[0]?.trim() ?? ""
                              : ""}
                          </span>
                          <span className={styles.prPricePeriod}>/ay</span>
                        </>
                      )}
                    </div>

                    {/* Sub-price info */}
                    <div className={styles.prSubPrice}>
                      {isTrial && plan.badge ? (
                        <span>{plan.badge}</span>
                      ) : isEnterprise ? (
                        <span>&Ouml;zel fiyatlandırma</span>
                      ) : plan.meta?.includes("Asim") ? (
                        <span>Aşım: {plan.meta.split("Asim:")[1]?.split("•")[0]?.trim()}</span>
                      ) : null}
                    </div>
                  </div>

                  {/* Divider */}
                  <div className={styles.prDivider} />

                  {/* Features */}
                  <ul className={styles.prFeatureList}>
                    {plan.bullets?.map((bullet) => (
                      <li key={bullet} className={styles.prFeatureItem}>
                        <span className={styles.prCheckIcon}>&#10003;</span>
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA Button */}
                  {plan.href && plan.actionLabel ? (
                    <div className={styles.prCardCta}>
                      <a
                        href={plan.href}
                        className={cn(
                          styles.prCardBtn,
                          isPopular && styles.prCardBtnPopular
                        )}
                      >
                        <span>{plan.actionLabel}</span>
                      </a>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══ Pay As You Go ══ */}
      <section className={styles.section}>
        <div className={styles.shell}>
          <div className={styles.prPaygHeader}>
            <span className={styles.prPaygBadge}>
              <span className={styles.prBadgeDot} />
              {PUBLIC_PAY_AS_YOU_GO.eyebrow}
            </span>
            <h2 className={styles.prSectionTitle}>{PUBLIC_PAY_AS_YOU_GO.title}</h2>
            <p className={styles.prSectionSubtitle}>
              Planınızı yükseltmeden, sadece ihtiyacınız olan ek kotayı satın alın.
            </p>
          </div>

          <div className={styles.prPaygCard}>
            <div className={styles.prPaygPrice}>
              {PUBLIC_PAY_AS_YOU_GO.meta}
            </div>
            <p className={styles.prPaygNote}>
              {PUBLIC_PAY_AS_YOU_GO.body}
            </p>

            <div className={styles.prPaygTags}>
              {PUBLIC_PAY_AS_YOU_GO.bullets?.map((tag) => (
                <span key={tag} className={styles.prPaygTag}>{tag}</span>
              ))}
            </div>

            {PUBLIC_PAY_AS_YOU_GO.href && PUBLIC_PAY_AS_YOU_GO.actionLabel ? (
              <a href={PUBLIC_PAY_AS_YOU_GO.href} className={styles.prPaygBtn}>
                <span>{PUBLIC_PAY_AS_YOU_GO.actionLabel}</span>
              </a>
            ) : null}
          </div>
        </div>
      </section>

      {/* ══ Overage Details ══ */}
      <section className={styles.section}>
        <div className={styles.shell}>
          <div className={styles.prOverageHeader}>
            <h2 className={styles.prSectionTitle}>Ek paket detayları</h2>
            <p className={styles.prSectionSubtitle}>
              Bu paketler mevcut plan kotanız yetmediğinde dönem içinde tek seferlik kapasite artışı sağlar.
            </p>
          </div>

          <div className={styles.prTableWrap}>
            <table className={styles.prTable}>
              <thead>
                <tr>
                  <th>Kanal</th>
                  <th>Birim</th>
                  <th>Paket fiyatı</th>
                  <th>Not</th>
                </tr>
              </thead>
              <tbody>
                {OVERAGE_ROWS.map((row, idx) => (
                  <tr key={`${row.channel}-${idx}`}>
                    <td className={styles.prTableBold}>{row.channel}</td>
                    <td>{row.unit}</td>
                    <td>{row.rate}</td>
                    <td className={styles.prTableMuted}>{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ══ CTA Section ══ */}
      <section className={styles.section}>
        <div className={styles.shell}>
          <div className={styles.prCtaSection}>
            <h2 className={styles.prCtaTitle}>Hala kararsız mısınız?</h2>
            <p className={styles.prCtaBody}>
              İhtiyacınıza göre doğru paketi birlikte seçelim.
            </p>
            <a href="/auth/signup" className={styles.prGlowBtn}>
              <span>Hesap Oluştur</span>
            </a>
          </div>
        </div>
      </section>

      {/* ══ FAQ ══ */}
      <section className={styles.section}>
        <div className={styles.shell}>
          <SectionHeader
            eyebrow="Sık Sorulan Sorular"
            title="Fiyatlandırma hakkında merak edilenler"
            subtitle="Karar vermeden önce en sık gelen sorulara göz atın."
            align="center"
          />
          <FAQBlock items={PUBLIC_FAQ} />
        </div>
      </section>

      {/* ══ Final contact link ══ */}
      <section className={styles.section}>
        <div className={styles.shell}>
          <p className={styles.prContactLine}>
            Sorularınız mı var?{" "}
            <a href="/contact" className={styles.prContactLink}>Bize ulaşın</a>
          </p>
        </div>
      </section>
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
            title="Pilot kapsamındaki entegrasyonlar"
            subtitle="Takvim, ATS ve webhook odaklı bağlantıları kontrollü şekilde devreye alın."
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
        title="İhtiyacınıza özel entegrasyon mu gerekiyor?"
        body="Mevcut işe alım altyapınıza uygun özel bağlantı ihtiyacınız varsa ekibimizle planlayalım."
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
            eyebrow="Candit Blog"
            title="AI destekli işe alım hakkında en son yazılar"
            subtitle="Sektör trendleri, en iyi uygulamalar ve AI ile işe alım süreçlerinizi nasıl optimize edeceğinizi keşfedin."
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
            <span className={styles.eyebrow}>Yeni içeriklerden haberdar olun</span>
            <h2 className={styles.ctaTitle}>AI ve işe alım dünyasındaki gelişmeleri takip edin</h2>
            <p className={styles.ctaBody}>
              Sektör trendleri, ürün güncellemeleri ve en iyi uygulamaları doğrudan e-posta adresinize alın.
            </p>
          </div>
          <div className={styles.newsletterForm}>
            <input type="email" placeholder="E-posta adresiniz" />
            <button type="button" className={cn(styles.button, styles.buttonPrimary)}>
              <span>Abone Ol</span>
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
              <span className={styles.cardEyebrow}>Yazı Bilgisi</span>
              <h3>{article.category}</h3>
              <div className={styles.bulletList}>
                <span>{article.date}</span>
                <span>{article.readTime}</span>
                <span>Candit Blog</span>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className={cn(styles.section, styles.sectionMuted)}>
        <div className={styles.shell}>
          <SectionHeader
            eyebrow="İlgili Yazılar"
            title="Bunları da okumak isteyebilirsiniz"
            subtitle="AI destekli işe alım ve sektör trendleri hakkında ilgili yazılar."
          />
          <div className={styles.articleGrid}>
            {relatedArticles.map((relatedArticle) => (
              <ArticleCard key={relatedArticle.slug} article={relatedArticle} />
            ))}
          </div>
        </div>
      </section>

      <CTASection
        title="AI ile işe alım sürecinizi dönüştürmeye hazır mısınız?"
        body="Platformumuzu ücretsiz deneyin ve farkı kendiniz görün."
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
            eyebrow="Yardım Merkezi"
            title="Candit ile hızlı başlangıç rehberi"
            subtitle="Platform kurulumundan ileri düzey kullanıma kadar ihtiyacınız olan tüm bilgiler burada."
            align="center"
          />
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.shell}>
          <SectionHeader
            eyebrow="Hızlı Başlangıç"
            title="Dakikalar içinde ilk mülakatınızı oluşturun"
          />
          <StepsGrid steps={PUBLIC_HELP_QUICKSTART} />
        </div>
      </section>

      <section className={cn(styles.section, styles.sectionMuted)}>
        <div className={styles.shell}>
          <SectionHeader
            eyebrow="Popüler Konular"
            title="Sık kullanılan konular"
          />
          <CardGrid cards={PUBLIC_HELP_TOPICS} columns={4} />
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.shell}>
          <SectionHeader eyebrow="SSS" title="Başka sorunuz mu var?" />
          <FAQBlock items={PUBLIC_FAQ} />
        </div>
      </section>

      <CTASection
        title="Aradığınızı bulamadınız mı?"
        body="Ekibimize doğrudan ulaşın, size en kısa sürede yardımcı olalım."
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
            eyebrow="API Dokümantasyonu"
            title="Candit API ile entegre olun"
            subtitle="REST API ve webhook desteği ile Candit'i mevcut İK sistemlerinize kolayca bağlayın."
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
                title: "Kimlik Doğrulama",
                body: "Bearer token ile API isteklerini güvenli şekilde yetkilendirin."
              },
              {
                title: "Webhook Bildirimleri",
                body: "Mülakat, değerlendirme, başvuru ve süreç olaylarını anlık takip edin."
              },
              {
                title: "Hız Limitleri",
                body: "Sistem kararlılığını korumak için dakikalık ve saatlik istek limitleri uygulanır."
              }
            ]}
          />
        </div>
      </section>

      <CTASection
        title="API entegrasyonunuz hakkında destek mi gerekiyor?"
        body="Teknik ekibimiz entegrasyon sürecinde size yardımcı olmaya hazır."
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
            eyebrow="Verileriniz Güvende"
            title="Kurumsal düzeyde veri güvenliği"
            subtitle="Aday verileriniz KVKK ve GDPR standartlarında, endüstri lideri güvenlik protokolleriyle korunur."
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
        title="Güvenlik hakkında sorularınız mı var?"
        body="Veri güvenliği ve uyumluluk konusundaki sorularınızı yanıtlamaktan memnuniyet duyarız."
        primary={{ label: "İletişime Geçin", href: "/contact" }}
        secondary={{ label: "Hesap Oluştur", href: "/auth/signup", tone: "secondary" }}
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
            eyebrow="Hakkımızda"
            title="İşe alımı yapay zeka ile yeniden tanımlıyoruz"
            subtitle="Her büyüklükteki şirketin en doğru adayı en hızlı şekilde bulabilmesi için AI destekli mülakat ve ön eleme çözümleri sunuyoruz."
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
            subtitle="İşe alım süreçlerindeki deneyim, yapay zeka ile birleşerek Candit'i ortaya çıkardı."
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
            title="Küçük ama tutkulu bir ekip"
            subtitle="Her ürün kararı, her özellik ve her iyileştirme İK ekiplerinin ve adayların ihtiyaçlarından hareketle geliştiriliyor."
            align="center"
          />
          <CardGrid cards={PUBLIC_TEAM} columns={3} />
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <CTASection
        title="Hikayemizin bir parçası olun"
        body="İşe alım süreçlerinizi AI ile dönüştürerek en doğru adayları en hızlı şekilde bulun."
        primary={{ label: "Hesap Oluştur", href: "/auth/signup" }}
        secondary={{ label: "İletişime Geçin", href: "/contact", tone: "secondary" }}
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
            eyebrow="İletişim"
            title="Size nasıl yardımcı olabiliriz?"
            subtitle="İşe alım süreçlerinizi AI ile dönüştürmek mi istiyorsunuz? Sorularınızı iletin, ekibimiz en kısa sürede size dönecektir."
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
          <LeadCaptureForm
            title="Bize Mesaj Gönderin"
            body="Formu doldurarak bize ulaşın. Pilot hedefiniz, mevcut işe alım akışınız ve ihtiyaç duyduğunuz otomasyonları paylaşın."
            submitLabel="Mesajı Gönder"
            sourcePage="contact"
            successTitle="Mesajınız ulaştı"
            successBody="Ekibimiz kısa süre içinde size dönüş yapacak."
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
      title="Gizlilik Politikası (Privacy Policy)"
      subtitle="Kişisel verilerinizin nasıl toplandığını, kullanıldığını ve korunduğunu öğrenin."
      sections={PUBLIC_PRIVACY_SECTIONS}
    />
  );
}

export function PublicTermsPage() {
  return (
    <PublicLegalPage
      title="Kullanım Koşulları (Terms of Service)"
      subtitle="Platformumuzu kullanırken geçerli olan kurallar, sorumluluklar ve haklarınız."
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
            eyebrow="Neler Değişiyor?"
            title="Ürün güncellemeleri ve yeni özellikler"
            subtitle="Candit platformundaki son geliştirmeleri ve yeni özellikleri takip edin."
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
        title="Yeni özelliklerden ilk siz haberdar olun"
        body="Hesap oluşturun ve platform güncellemelerini doğrudan takip edin."
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
              eyebrow="Hemen Başlayın"
              title="Bekleme listesi yerine doğrudan hesap oluşturun"
              subtitle="Ücretsiz hesap oluşturun ve AI destekli işe alım platformunu hemen denemeye başlayın."
            />
            <StepsGrid
              steps={[
                { step: "01", title: "Owner hesabını açın", body: "İlk çalışma alanınızı ve yönetici hesabınızı birkaç dakika içinde oluşturun." },
                { step: "02", title: "Temel ayarları tamamlayın", body: "Takım üyeleri, entegrasyonlar ve ürün ayarlarını içeriden yönetin." },
                { step: "03", title: "Pilotu başlatın", body: "İlan, aday ve mülakat akışlarını gerçek kullanım senaryolarınızla çalıştırın." },
                { step: "04", title: "Destek gerekiyorsa yazın", body: "Ekibimiz kurulum ve onboarding sürecinde size yardımcı olmaya hazır." }
              ]}
            />
          </div>

          <div className={styles.formCard}>
            <span className={styles.eyebrow}>Kayıt</span>
            <h3>Doğrudan hesap oluşturun</h3>
            <p>Hemen hesap oluşturun ve AI destekli işe alım platformunu denemeye başlayın. Kurulum desteği için ekibimiz her zaman yanınızda.</p>
            <div className={styles.tagList}>
              <span>Owner hesabı</span>
              <span>E-posta doğrulama</span>
              <span>İlk workspace kurulumu</span>
            </div>
            <div className={styles.ctaActions} style={{ marginTop: 18 }}>
              <ActionLink action={{ label: "Hesap Oluştur", href: "/auth/signup" }} fullWidth />
              <ActionLink
                action={{ label: "İletişime Geçin", href: "/contact", tone: "secondary" }}
                tone="secondary"
                fullWidth
              />
            </div>
          </div>
        </div>
      </section>
    </PublicSiteFrame>
  );
}
