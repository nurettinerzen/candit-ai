"use client";

import type { ReactNode } from "react";
import styles from "./public-site.module.css";
import { LandingHero } from "./landing-hero";
import { PublicLeadForm } from "./public-lead-form";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";
import { useUiText } from "./site-language-provider";
import {
  buildBillingPlanCatalogCards
} from "../lib/billing-presentation";
import {
  PUBLIC_ABOUT_STATS,
  PUBLIC_ABOUT_STORY,
  PUBLIC_BLOG_ARTICLES,
  PUBLIC_CHANGELOG,
  PUBLIC_FAQ,
  PUBLIC_FEATURE_GROUPS,
  PUBLIC_FEATURE_OPERATIONS,
  PUBLIC_HELP_QUICKSTART,
  PUBLIC_HELP_TOPICS,
  PUBLIC_HOME_CHANNELS,
  PUBLIC_HOME_PROOF,
  PUBLIC_HOME_STEPS,
  PUBLIC_PRICING_TRIAL_CARD,
  PUBLIC_PRIVACY_SECTIONS,
  PUBLIC_SECURITY_GROUPS,
  PUBLIC_SOLUTIONS,
  PUBLIC_SOLUTIONS_ADVANTAGES,
  PUBLIC_SOLUTIONS_STATS,
  PUBLIC_TEAM,
  PUBLIC_TERMS_SECTIONS,
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
  const { t } = useUiText();
  return (
    <div className={cn(styles.sectionHeader, align === "center" && styles.sectionHeaderCentered)}>
      {eyebrow ? <span className={styles.eyebrow}>{t(eyebrow)}</span> : null}
      <h2 className={styles.sectionTitle}>{t(title)}</h2>
      {subtitle ? <p className={styles.sectionSubtitle}>{t(subtitle)}</p> : null}
    </div>
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
  const { t } = useUiText();
  return (
    <div className={cn(styles.statsGrid, columns === 4 && styles.statsGridFour)}>
      {items.map((item) => (
        <article key={`${item.label}-${item.value}`} className={styles.metricCard}>
          <strong>{t(item.value)}</strong>
          <h3>{t(item.label)}</h3>
          {item.detail ? <p>{t(item.detail)}</p> : null}
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
  const { t } = useUiText();
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
          {card.badge ? <span className={styles.cardBadge}>{t(card.badge)}</span> : null}
          {card.eyebrow ? <span className={styles.cardEyebrow}>{t(card.eyebrow)}</span> : null}
          {card.icon ? <span className={styles.cardIcon}>{card.icon}</span> : null}
          <h3>{t(card.title)}</h3>
          <p>{t(card.body)}</p>
          {card.meta ? <div className={styles.cardMeta}>{t(card.meta)}</div> : null}
          {card.bullets?.length ? (
            <div className={styles.bulletList}>
              {card.bullets.map((bullet) => (
                <span key={bullet}>{t(bullet)}</span>
              ))}
            </div>
          ) : null}
          {card.href && card.actionLabel ? (
            <a href={card.href} className={styles.inlineLink}>
              {t(card.actionLabel)}
            </a>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function StepsGrid({ steps }: { steps: PublicStep[] }) {
  const { t } = useUiText();
  return (
    <div className={styles.stepsGrid}>
      {steps.map((step) => (
        <article key={`${step.step}-${step.title}`} className={styles.stepCard}>
          <span className={styles.stepIndex}>{step.step}</span>
          <h3>{t(step.title)}</h3>
          <p>{t(step.body)}</p>
        </article>
      ))}
    </div>
  );
}

function FAQBlock({ items }: { items: PublicFaq[] }) {
  const { t } = useUiText();
  return (
    <div className={styles.faqList}>
      {items.map((item) => (
        <details key={item.question} className={styles.faqItem}>
          <summary>{t(item.question)}</summary>
          <p>{t(item.answer)}</p>
        </details>
      ))}
    </div>
  );
}

function CTASection({
  title,
  body,
  primary = { label: "Ücretsiz deneme", href: "/auth/signup" },
  secondary = { label: "Paketler", href: "/pricing", tone: "secondary" }
}: {
  title: string;
  body: string;
  primary?: PublicAction;
  secondary?: PublicAction;
}) {
  const { t } = useUiText();
  return (
    <section className={styles.section}>
      <div className={cn(styles.shell, styles.ctaBand)}>
        <div>
          <span className={styles.eyebrow}>{t("Sonraki adım")}</span>
          <h2 className={styles.ctaTitle}>{t(title)}</h2>
          <p className={styles.ctaBody}>{t(body)}</p>
        </div>
        <div className={styles.ctaActions}>
          <ActionLink action={{ ...primary, label: t(primary.label) }} />
          <ActionLink action={{ ...secondary, label: t(secondary.label) }} tone="secondary" />
        </div>
      </div>
    </section>
  );
}

function ProductStage() {
  const { t } = useUiText();
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
          {t("Pilot ortam")}
        </span>
      </div>

      <div className={styles.stageHeadline}>
        <div>
          <span className={styles.stageEyebrow}>{t("Tek platform, tam kontrol")}</span>
          <h2>{t("Tüm işe alım süreçleri tek panelde buluşur.")}</h2>
        </div>
        <div className={styles.stageScore}>
          <strong>{t("Pilot hazır")}</strong>
          <span>{t("temel işe alım akışı")}</span>
        </div>
      </div>

      <div className={styles.stageTrack}>
        {PUBLIC_HOME_STEPS.map((step) => (
          <div key={step.step} className={styles.stageTrackStep}>
            <i />
            <strong>{t(step.title)}</strong>
            <span>{t(step.body)}</span>
          </div>
        ))}
      </div>

      <div className={styles.stagePanels}>
        <article className={styles.stagePanel}>
          <div className={styles.stagePanelLabel}>{t("Modüller")}</div>
          <div className={styles.inboundList}>
            {PUBLIC_HOME_CHANNELS.map((channel) => (
              <div key={channel.title} className={styles.inboundItem}>
                <span className={styles.channelBadge}>{channel.icon}</span>
                <div>
                  <strong>{t(channel.title)}</strong>
                  <span>{t(channel.body)}</span>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className={cn(styles.stagePanel, styles.stagePanelWide)}>
          <div className={styles.stagePanelLabel}>{t("Akış görünürlüğü")}</div>
          <div className={styles.signalPanel}>
            <div className={styles.signalRing}>
              <span>{t("Tek panel")}</span>
              <small>{t("operasyon")}</small>
            </div>

            <div className={styles.signalBody}>
              <h3>{t("Tek panelde izlenebilir işe alım akışı.")}</h3>
              <p>
                {t("Ön eleme, mülakat ve değerlendirme adımları aynı operasyon görünümü içinde takip edilir.")}
              </p>
              <div className={styles.progressList}>
                <div>
                  <span>{t("Ön eleme görünürlüğü")}</span>
                  <i>
                    <b style={{ width: "78%" }} />
                  </i>
                </div>
                <div>
                  <span>{t("Mülakat akışı")}</span>
                  <i>
                    <b style={{ width: "84%" }} />
                  </i>
                </div>
                <div>
                  <span>{t("Rapor ve karar desteği")}</span>
                  <i>
                    <b style={{ width: "88%" }} />
                  </i>
                </div>
              </div>
            </div>
          </div>
        </article>

        <article className={styles.stagePanel}>
          <div className={styles.stagePanelLabel}>{t("Örnek akış")}</div>
          <div className={styles.scheduleCard}>
            <span className={styles.scheduleBadge}>{t("Bugün")}</span>
            <strong>{t("AI mülakat değerlendirmesi")}</strong>
            <p>{t("Aday AI mülakat ile başlar, değerlendirme otomatik oluşturulur ve sonuçlar panele düşer.")}</p>
            <div className={styles.tagList}>
              <span>{t("AI Mülakat")}</span>
              <span>{t("Ön Eleme")}</span>
              <span>{t("Analitik")}</span>
            </div>
          </div>
          <div className={styles.miniLog}>
            <i />
            <span>{t("Tüm mülakat ve değerlendirme kayıtları tek panelde görünür.")}</span>
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
  const { t } = useUiText();
  return (
    <article className={styles.card}>
      <span className={styles.cardEyebrow}>{t(article.category)}</span>
      <h3>{t(article.title)}</h3>
      <p>{t(article.excerpt)}</p>
      <div className={styles.articleMeta}>
        <span>{t(article.date)}</span>
        <span>{t(article.readTime)}</span>
      </div>
      <a href={`/blog/${article.slug}`} className={styles.inlineLink}>
        {t("Yazıyı oku")}
      </a>
    </article>
  );
}

function LeadCaptureForm({
  eyebrow,
  title,
  body,
  submitLabel,
  sourcePage,
  successTitle,
  successBody
}: {
  eyebrow?: string | null;
  title: string;
  body: string;
  submitLabel: string;
  sourcePage: string;
  successTitle: string;
  successBody: string;
}) {
  return (
    <PublicLeadForm
      eyebrow={eyebrow}
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
  const { t } = useUiText();
  return (
    <div className={styles.timeline}>
      {items.map((entry) => (
        <article key={`${entry.date}-${entry.title}`} className={styles.timelineItem}>
          <div className={styles.timelineMeta}>
            <span>{t(entry.date)}</span>
            {entry.version ? <strong>{entry.version}</strong> : null}
          </div>
          <div className={styles.timelineCard}>
            <h3>{t(entry.title)}</h3>
            <p>{t(entry.body)}</p>
            <div className={styles.bulletList}>
              {entry.items.map((item) => (
                <span key={item}>{t(item)}</span>
              ))}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function LegalSections({ sections }: { sections: PublicLegalSection[] }) {
  const { t } = useUiText();
  return (
    <div className={styles.legalList}>
      {sections.map((section) => (
        <article key={section.title} className={styles.legalCard}>
          <h3>{t(section.title)}</h3>
          <p>{t(section.body)}</p>
        </article>
      ))}
    </div>
  );
}

function DocsEndpoints() {
  const { locale, t } = useUiText();
  const exampleMessage =
    locale === "en"
      ? t("I want to share API details.")
      : t("API detaylarını paylaşmak istiyorum.");
  const endpoints = [
    {
      method: "GET",
      path: "/v1/health",
      body: "Servis durumu ve temel çalışma zamanı hazırlığını doğrular."
    },
    {
      method: "GET",
      path: "/v1/auth/providers",
      body: "Etkin giriş sağlayıcılarını ve auth seçeneklerini listeler."
    },
    {
      method: "POST",
      path: "/v1/public/contact",
      body: "İletişim ve demo taleplerini kayıt altına alır."
    },
    {
      method: "POST",
      path: "/v1/integrations/webhooks/:provider",
      body: "Desteklenen webhook sağlayıcılarından gelen olayları işler."
    }
  ];

  return (
    <div className={styles.docsGrid}>
      <div className={styles.codeCard}>
        <span className={styles.cardEyebrow}>{t("API Uç Noktaları")}</span>
        <h3>{t("Başlamak için temel uç noktalar")}</h3>
        <pre className={styles.codeBlock}>
          <code>{`curl -X POST https://your-api-host/v1/public/contact \\
  -H "Content-Type: application/json" \\
  -d '{
    "fullName": "Jane Recruiter",
    "email": "jane@example.com",
    "company": "Candit Pilot",
    "message": "${exampleMessage}"
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
            <p>{t(endpoint.body)}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function SolutionWorkflow({ solution }: { solution: PublicSolution }) {
  const { t } = useUiText();
  const workflow = [
    {
      step: "01",
      title: t("Pozisyonu tanımlayın"),
      body: t(`${solution.label} sektörüne özel mülakat soruları ve değerlendirme kriterlerini belirleyin.`)
    },
    {
      step: "02",
      title: t("Araçları etkinleştirin"),
      body: t(`${solution.channels.join(", ")} araçlarını aktif edin ve işe alım sürecinizi başlatın.`)
    },
    {
      step: "03",
      title: t("AI mülakat yaptırın"),
      body: t("Adaylar AI mülakat ile değerlendirilir, yanıtlar analiz edilir ve yetkinlik raporu oluşturulur.")
    },
    {
      step: "04",
      title: t("Sonuçları değerlendirin"),
      body: t("Mülakat tamamlanma, değerlendirme skoru ve karşılaştırmalı raporlarla en uygun adayı belirleyin.")
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
  const { t } = useUiText();
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

  /* Icons for feature groups */
  const featureIcons = [
    /* AI Mülakat */ <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>,
    /* Ön Eleme */ <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
    /* Aday Değerlendirme */ <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
    /* İş İlanı Yönetimi */ <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
    /* Analitik */ <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
    /* Aday Havuzu */ <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>,
  ];

  /* Gradient classes mapped to feature groups */
  const featureGradients = [
    styles.ftGradBlue, styles.ftGradNavy,
    styles.ftGradDeep, styles.ftGradCyan, styles.ftGradReverse, styles.ftGradDark
  ];
  const operationGradients = [styles.ftGradCyan, styles.ftGradNavy, styles.ftGradDark];
  const operationIcons = [
    /* Dashboard */ <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>,
    /* Güvenlik */ <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
    /* Aday Yönetimi */ <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  ];
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
              {t("Güçlü Özellikler")}
            </span>
            <h1 className={styles.ftHeroTitle}>
              {t("İşe alım sürecinizi güçlendirecek AI yetenekleri")}
            </h1>
            <p className={styles.ftHeroSubtitle}>
              {t("AI mülakat, aday tarama, iş ilanı yönetimi ve analitik araçları tek platformda. Hızlı kurulum, net operasyon görünürlüğü ve ölçeklenebilir otomasyon.")}
            </p>
            <div className={styles.ftHeroActions}>
              <a href="/auth/signup" className={cn(styles.ftGlowBtn, styles.ftGlowBtnPrimary)}>
                {t("Ücretsiz deneme")}
              </a>
              <a href="#features-grid" className={cn(styles.ftGlowBtn, styles.ftGlowBtnOutline)}>
                {t("Özellikleri Keşfedin")}
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
                      <div className={cn(styles.ftIcon, featureGradients[index])}>{featureIcons[index]}</div>
                      <h3 className={cn(styles.ftCardTitle, styles.ftCardTitleLg)}>{t(feature.title)}</h3>
                      <p className={styles.ftCardDesc}>{t(feature.body)}</p>
                      {feature.bullets?.length ? (
                        <div className={styles.ftCheckList}>
                          {feature.bullets.map((item) => (
                            <div key={item} className={styles.ftCheckItem}>
                              <span className={styles.ftCheck}><CheckSvg /></span>
                              <span>{t(item)}</span>
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
                      <div className={cn(styles.ftIcon, featureGradients[index + 2])}>{featureIcons[index + 2]}</div>
                      <h3 className={styles.ftCardTitle}>{t(feature.title)}</h3>
                      <p className={styles.ftCardDesc}>{t(feature.body)}</p>
                      {feature.bullets?.length ? (
                        <div className={styles.ftCheckList}>
                          {feature.bullets.map((item) => (
                            <div key={item} className={styles.ftCheckItem}>
                              <span className={styles.ftCheck}><CheckSvg /></span>
                              <span>{t(item)}</span>
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
              <h2 className={styles.ftSectionTitle}>{t("Operasyon görünürlüğü ve yönetim araçları")}</h2>
              <p className={styles.ftSectionSubtitle}>
                {t("Dashboard, güvenlik ve yönetim katmanlarıyla ekibiniz ve yöneticileriniz aynı veriden karar verir.")}
              </p>
            </div>
            <div className={styles.ftDeepGrid}>
              {PUBLIC_FEATURE_OPERATIONS.map((op, index) => (
                <article key={op.title} className={styles.ftDeepCard}>
                  <div style={{ position: 'relative', zIndex: 10 }}>
                    <div className={cn(styles.ftIcon, operationGradients[index])}>{operationIcons[index]}</div>
                    <h3 className={styles.ftCardTitle}>{t(op.title)}</h3>
                    <p className={styles.ftCardDesc}>{t(op.body)}</p>
                    {op.bullets?.length ? (
                      <div className={styles.ftCheckList}>
                        {op.bullets.map((item) => (
                          <div key={item} className={styles.ftCheckItem}>
                            <span className={styles.ftCheck}><CheckSvg /></span>
                            <span>{t(item)}</span>
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
              <h2 className={styles.ftSectionTitle}>{t("Dakikalar içinde yayına alın")}</h2>
              <p className={styles.ftSectionSubtitle}>
                {t("Dört adımda AI mülakat sisteminizi kurun ve işe alım süreçlerinizde canlı hizmete başlayın.")}
              </p>
            </div>
            <div className={styles.ftStepsGrid}>
              <div className={styles.ftConnector} aria-hidden="true" />
              {PUBLIC_HOME_STEPS.map((step, index) => {
                const stepIcons = [
                  <svg key="s1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
                  <svg key="s2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
                  <svg key="s3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>,
                  <svg key="s4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
                ];
                return (
                <div key={step.step} className={styles.ftStep}>
                  <div className={cn(styles.ftStepCircle, stepGradients[index % stepGradients.length])}>
                    {stepIcons[index]}
                  </div>
                  <div className={styles.ftStepNumber}>{step.step}</div>
                  <h3 className={styles.ftStepTitle}>{t(step.title)}</h3>
                  <p className={styles.ftStepDesc}>{t(step.body)}</p>
                </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ═══ Sector Solution Cards ═══ */}
        <section className={styles.ftSection}>
          <div className={styles.shell}>
            <div className={styles.ftSectionHeader}>
              <h2 className={styles.ftSectionTitle}>{t("Farklı sektörler, aynı verimlilik")}</h2>
              <p className={styles.ftSectionSubtitle}>
                {t("Teknoloji, perakende, sağlık, finans ve üretim sektörlerine özel mülakat akışları.")}
              </p>
            </div>
            <div className={styles.ftSolutionGrid}>
              {PUBLIC_SOLUTIONS.map((solution, index) => (
                <a key={solution.slug} href={`/solutions/${solution.slug}`} className={styles.ftSolutionCard}>
                  <div className={styles.ftSolutionCardInner}>
                    <div className={cn(styles.ftSolutionIcon, featureGradients[index % featureGradients.length])}>
                      {[
                        <svg key="tech" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>,
                        <svg key="retail" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>,
                        <svg key="health" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
                        <svg key="finance" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
                        <svg key="mfg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
                      ][index]}
                    </div>
                    <div style={{ flex: 1 }}>
                      <h3 className={styles.ftSolutionTitle}>{t(solution.title)}</h3>
                      <p className={styles.ftSolutionDesc}>{t(solution.shortDescription)}</p>
                      <span className={styles.ftSolutionLink}>
                        {t("Çözümü incele")} <ArrowRightSvg />
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
              <h2 className={styles.ftSectionTitle}>{t("Merak edilenler")}</h2>
              <p className={styles.ftSectionSubtitle}>
                {t("Özellikler, kurulum ve kullanım hakkında en çok sorulan sorular.")}
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
                <h2 className={styles.ftCtaTitle}>{t("AI ile işe alım deneyiminizi dönüştürün")}</h2>
                <p className={styles.ftCtaSubtitle}>
                  {t("Tüm özelliklerimizi ücretsiz deneyin. Kurulum dakikalar içinde tamamlanır, teknik bilgi gerekmez.")}
                </p>
                <div className={styles.ftCtaActions}>
                  <a href="/auth/signup" className={cn(styles.ftGlowBtn, styles.ftCtaBtnWhite)}>
                    {t("Ücretsiz deneme")}
                  </a>
                  <a href="/contact" className={cn(styles.ftGlowBtn, styles.ftCtaBtnGhost)}>
                    {t("İletişime geçin")}
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
  const { t } = useUiText();
  const CheckSvg = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
  );
  const SparklesSvg = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" /><path d="M5 3v4" /><path d="M19 17v4" /><path d="M3 5h4" /><path d="M17 19h4" /></svg>
  );
  const ArrowRightSvg = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
  );

  const solutionIcons = [
    /* Teknoloji */ <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>,
    /* Perakende */ <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>,
    /* Sağlık */ <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
    /* Finans */ <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
    /* Üretim/Lojistik */ <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
  ];
  const solutionGradients = [
    styles.ftGradBlue, styles.ftGradNavy, styles.ftGradCyan, styles.ftGradDeep
  ];
  const advantageGradients = [
    styles.ftGradCyan, styles.ftGradNavy, styles.ftGradBlue, styles.ftGradDeep
  ];
  const advantageIcons = [
    /* Hızlı */ <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
    /* Objektif */ <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
    /* Ölçeklenebilir */ <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
    /* Uyum */ <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
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
              {t("Çözümler")}
            </span>
            <h1 className={styles.solHeroTitle}>
              {t("Her sektörde doğru adayı daha hızlı bulun")}
            </h1>
            <p className={styles.solHeroSubtitle}>
              {t("Teknoloji, perakende, sağlık, finans ve üretim sektörlerine özel AI mülakat ve ön eleme akışları ile hemen başlayın.")}
            </p>
            <div className={styles.solHeroActions}>
              <a href="#solutions-grid" className={cn(styles.solGlowBtn, styles.solGlowBtnPrimary)}>
                {t("Çözümleri Keşfedin")}
              </a>
              <a href="/contact" className={cn(styles.solGlowBtn, styles.solGlowBtnOutline)}>
                {t("İletişime geçin")}
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
                  <div className={styles.solStatValue}>{t(stat.value)}</div>
                  <div className={styles.solStatLabel}>{t(stat.label)}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ Solutions Grid ═══ */}
        <section className={styles.solSection} id="solutions-grid">
          <div className={styles.shell}>
            <div className={styles.solSectionHeader}>
              <h2 className={styles.solSectionTitle}>{t("Sektörünüzü seçin, hemen başlayın")}</h2>
              <p className={styles.solSectionSubtitle}>
                {t("Her çözüm, sektörün ihtiyaçlarına özel AI mülakat akışları, ön eleme kriterleri ve değerlendirme metrikleriyle donatıldı.")}
              </p>
            </div>
            <div className={styles.solGrid}>
              {PUBLIC_SOLUTIONS.map((solution, index) => (
                <a key={solution.slug} href={`/solutions/${solution.slug}`} className={styles.solCard}>
                  <div className={cn(styles.solCardBlur, solutionGradients[index % solutionGradients.length])} aria-hidden="true" />
                  <div className={styles.solCardContent}>
                    <div className={cn(styles.solCardIcon, solutionGradients[index % solutionGradients.length])}>{solutionIcons[index]}</div>
                    <h3 className={styles.solCardTitle}>{t(solution.title)}</h3>
                    <p className={styles.solCardDesc}>{t(solution.shortDescription)}</p>
                    <div className={styles.solCheckList}>
                      {solution.useCases.map((useCase) => (
                        <div key={useCase} className={styles.solCheckItem}>
                          <span className={styles.solCheck}><CheckSvg /></span>
                          <span>{t(useCase)}</span>
                        </div>
                      ))}
                    </div>
                    <span className={styles.solCardCta}>
                      {t("Çözümü incele")}
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
              <h2 className={styles.solSectionTitle}>{t("Neden Candit.ai?")}</h2>
              <p className={styles.solSectionSubtitle}>
                {t("Sektörden bağımsız olarak her işe alım ekibine değer katan temel avantajlar.")}
              </p>
            </div>
            <div className={styles.solBentoGrid}>
              {PUBLIC_SOLUTIONS_ADVANTAGES.map((advantage, index) => (
                <article key={advantage.title} className={styles.solBentoItem}>
                  <div className={styles.solBentoItemInner}>
                    <div className={cn(styles.solBentoIcon, advantageGradients[index % advantageGradients.length])}>{advantageIcons[index]}</div>
                    <h3 className={styles.solBentoTitle}>{t(advantage.title)}</h3>
                    <p className={styles.solBentoDesc}>{t(advantage.body)}</p>
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
              <h2 className={styles.solSectionTitle}>{t("Karar öncesi merak edilenler")}</h2>
              <p className={styles.solSectionSubtitle}>
                {t("Çözümler, kurulum süreci ve fiyatlandırma hakkında en sık sorulan sorular.")}
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
                <h2 className={styles.solCtaTitle}>{t("Sektörünüze özel AI işe alım çözümünü deneyin")}</h2>
                <p className={styles.solCtaSubtitle}>
                  {t("Listede olsun ya da olmasın, sektörünüze uygun mülakat ve ön eleme akışını birlikte tasarlayalım.")}
                </p>
                <div className={styles.solCtaActions}>
                  <a href="/contact" className={styles.solCtaBtnWhite}>
                    {t("İletişime geçin")}
                  </a>
                  <a href="/auth/signup" className={styles.solCtaBtnGhost}>
                    {t("Ücretsiz deneme")}
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
  const { t } = useUiText();
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
                { label: t("Ana Sayfa"), href: "/" },
                { label: t("Çözümler"), href: "/solutions" },
                { label: t(solution.label) }
              ]}
            />
            <span className={styles.heroKicker}>{t(solution.label)}</span>
            <h1 className={styles.solutionTitle}>{t(solution.title)}</h1>
            <p className={styles.solutionIntro}>{t(solution.intro)}</p>
            <div className={styles.heroActions}>
              <ActionLink action={{ label: t("Ücretsiz deneme"), href: "/auth/signup" }} />
              <ActionLink
                action={{ label: t("Paketler"), href: "/pricing", tone: "secondary" }}
                tone="secondary"
              />
            </div>
          </div>

          <div className={styles.solutionShowcase}>
            <div className={styles.showcaseCard}>
              <span className={styles.cardEyebrow}>{t("Kullanım Senaryoları")}</span>
              <h3>{t(solution.shortDescription)}</h3>
              <div className={styles.bulletList}>
                {solution.useCases.map((item) => (
                  <span key={item}>{t(item)}</span>
                ))}
              </div>
            </div>
            <div className={styles.showcaseStats}>
              {PUBLIC_SOLUTIONS_STATS.slice(0, 3).map((item) => (
                <div key={item.label} className={styles.showcaseStat}>
                  <strong>{t(item.value)}</strong>
                  <span>{t(item.label)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.shell}>
          <SectionHeader
            eyebrow={t("Nasıl Çalışır?")}
            title={t(`${solution.label} operasyonuna uygun kurulum akışı`)}
            subtitle={t("Pozisyonu tanımlayın, adayları yönlendirin ve AI mülakat akışını başlatın. Süreç aynı panelde görünür kalır.")}
          />
          <SolutionWorkflow solution={solution} />
        </div>
      </section>

      <section className={cn(styles.section, styles.sectionMuted)}>
        <div className={styles.shell}>
          <SectionHeader
            eyebrow={t("Kullanım Senaryoları")}
            title={t("Saha gerçeğine yakın örnek akışlar")}
            subtitle={t("Sektörünüze özel AI mülakat ve ön eleme senaryolarını inceleyin.")}
          />
          <CardGrid
            cards={solution.useCases.map((item, index) => ({
              title: `${t("Senaryo")} ${index + 1}`,
              body: item
            }))}
            columns={3}
          />
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.shell}>
          <SectionHeader
            eyebrow={t(`${solution.label} İçin Öne Çıkanlar`)}
            title={t("Operasyonun kritik avantajları")}
            subtitle={t("Bu sektördeki işe alım sürecinizi hızlandıran temel avantajlar.")}
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
            eyebrow={t("Kullanılan Araçlar")}
            title={t("İşe alım sürecinin her adımında AI desteği")}
            subtitle={t("Candit'in temel araçları bu sektör çözümünde nasıl kullanılıyor?")}
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
  const { t, locale } = useUiText();
  const pricingPlans = buildBillingPlanCatalogCards(locale, {
    enterprisePriceLabel: locale === "en" ? "Contact Us" : "İletişime geçin"
  }).map((plan) => ({
    ...plan,
    href: plan.key === "ENTERPRISE" ? "/contact" : "/auth/signup",
    actionLabel: plan.key === "ENTERPRISE" ? "İletişime geçin" : "Ücretsiz deneme"
  }));

  return (
    <PublicSiteFrame activeHref="/pricing">
      {/* ══ Hero ══ */}
      <section className={styles.prHero}>
        <div className={styles.prGlowBlob} style={{ width: 500, height: 500, top: -100, left: "10%" }} aria-hidden="true" />
        <div className={styles.prGlowBlobPurple} style={{ width: 400, height: 400, top: 50, right: "5%" }} aria-hidden="true" />

        <div className={cn(styles.shell, styles.prHeroInner)}>
          <span className={styles.prBadge}>
            <span className={styles.prBadgeDot} />
            {t("Şeffaf Fiyatlandırma")}
          </span>
          <h1 className={styles.prHeroTitle}>
            {t("İhtiyacınıza uygun planı seçin")}
          </h1>
          <p className={styles.prHeroSubtitle}>
            {t("Kullandıkça öde, aylık paketler veya kurumsal kurulum arasından seçim yapın. İhtiyacınıza göre ilerleyin.")}
          </p>
        </div>
      </section>

      {/* ══ Plan Cards ══ */}
      <section className={styles.prPlansSection}>
        <div className={styles.shell}>
          <div className={styles.prCardsGrid}>
            {pricingPlans.map((plan) => {
              return (
                <article
                  key={plan.key}
                  className={cn(styles.prPlanCard, plan.isRecommended && styles.prPlanCardPopular)}
                >
                  {plan.isRecommended && (
                    <div className={styles.prPopularBadgeWrap}>
                      <span className={styles.prPopularBadge}>{t("En Popüler")}</span>
                    </div>
                  )}

                  <div className={styles.prPlanHeader}>
                    <h3 className={styles.prPlanName}>{plan.title}</h3>
                    <div className={styles.prPriceBlock}>
                      {plan.priceDisplay === "text" ? (
                        <span className={styles.prPriceContact}>{plan.priceAmount}</span>
                      ) : (
                        <>
                          <span className={styles.prPriceAmount}>{plan.priceAmount}</span>
                          {plan.priceSuffix ? (
                            <span className={styles.prPricePeriod}>{plan.priceSuffix}</span>
                          ) : null}
                        </>
                      )}
                    </div>
                  </div>

                  <div className={styles.prDivider} />

                  <ul className={styles.prFeatureList}>
                    {plan.featureList.map((feature) => (
                      <li key={feature} className={styles.prFeatureItem}>
                        <span className={styles.prCheckIcon}>&#10003;</span>
                        <span>{t(feature)}</span>
                      </li>
                    ))}
                  </ul>

                  {plan.href && plan.actionLabel ? (
                    <div className={styles.prCardCta}>
                      <a
                        href={plan.href}
                        className={cn(
                          styles.prCardBtn,
                          plan.isRecommended && styles.prCardBtnPopular
                        )}
                      >
                        <span>{t(plan.actionLabel)}</span>
                      </a>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══ CTA Section ══ */}
      <section className={styles.section}>
        <div className={styles.shell}>
          <div className={cn(styles.prCtaSection, styles.prTrialSection)}>
            <div className={styles.prTrialCopy}>
              {PUBLIC_PRICING_TRIAL_CARD.eyebrow ? (
                <span className={styles.prTrialEyebrow}>{t(PUBLIC_PRICING_TRIAL_CARD.eyebrow)}</span>
              ) : null}
              <h2 className={styles.prCtaTitle}>{t(PUBLIC_PRICING_TRIAL_CARD.title)}</h2>
              <p className={styles.prCtaBody}>{t(PUBLIC_PRICING_TRIAL_CARD.body)}</p>
            </div>

            <div className={styles.prTrialAction}>
              <a href={PUBLIC_PRICING_TRIAL_CARD.href} className={styles.prGlowBtn}>
                <span>{t(PUBLIC_PRICING_TRIAL_CARD.actionLabel ?? "Ücretsiz deneme")}</span>
              </a>
            </div>
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
            {t("Sorularınız mı var?")}{" "}
            <a href="/contact" className={styles.prContactLink}>{t("Bize ulaşın")}</a>
          </p>
        </div>
      </section>
    </PublicSiteFrame>
  );
}

export function PublicBlogIndexPage() {
  const { t } = useUiText();
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
            <span className={styles.eyebrow}>{t("Yeni içeriklerden haberdar olun")}</span>
            <h2 className={styles.ctaTitle}>{t("Yeni içerikler ve ürün notları için bağlantıda kalın")}</h2>
            <p className={styles.ctaBody}>
              {t("Şimdilik e-posta aboneliği yerine blog ve iletişim kanalı üzerinden güncellemeleri paylaşıyoruz.")}
            </p>
          </div>
          <div className={styles.ctaActions}>
            <ActionLink action={{ label: t("Blog yazılarını inceleyin"), href: "/blog" }} />
            <ActionLink
              action={{ label: t("Güncelleme talebi bırakın"), href: "/contact", tone: "secondary" }}
              tone="secondary"
            />
          </div>
        </div>
      </section>
    </PublicSiteFrame>
  );
}

export function PublicBlogArticlePage({ slug }: { slug: string }) {
  const { t } = useUiText();
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
              { label: t("Ana Sayfa"), href: "/" },
              { label: "Blog", href: "/blog" },
              { label: t(article.title) }
            ]}
          />
          <span className={styles.heroKicker}>{t(article.category)}</span>
          <h1 className={styles.articleTitle}>{t(article.title)}</h1>
          <div className={styles.articleMetaLarge}>
            <span>{t(article.date)}</span>
            <span>{t(article.readTime)} {t("okuma")}</span>
          </div>
          <p className={styles.articleLead}>{t(article.excerpt)}</p>
        </div>
      </section>

      <section className={styles.section}>
        <div className={cn(styles.shell, styles.articleLayout)}>
          <div className={styles.articleContent}>
            {article.sections.map((section) => (
              <article key={section.title} className={styles.articleSection}>
                <h2>{t(section.title)}</h2>
                <p>{t(section.body)}</p>
              </article>
            ))}
          </div>

          <aside className={styles.articleAside}>
            <div className={styles.card}>
              <span className={styles.cardEyebrow}>{t("Yazı Bilgisi")}</span>
              <h3>{t(article.category)}</h3>
              <div className={styles.bulletList}>
                <span>{t(article.date)}</span>
                <span>{t(article.readTime)}</span>
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
  const { t } = useUiText();

  return (
    <PublicSiteFrame>
      <section className={styles.heroSectionSlim}>
        <div className={styles.shell}>
          <SectionHeader
            eyebrow={t("API Dokümantasyonu")}
            title={t("Candit API ile entegre olun")}
            subtitle={t("REST API ve webhook senaryolarıyla Candit'i mevcut İK sistemlerinize bağlayın.")}
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
                title: t("Kimlik Doğrulama"),
                body: t("JWT ve provider tabanlı auth akışlarıyla korumalı uç noktalara erişin.")
              },
              {
                title: t("Webhook Bildirimleri"),
                body: t("Mülakat, değerlendirme, başvuru ve süreç olaylarını provider bazında takip edin.")
              },
              {
                title: t("Hız Limitleri"),
                body: t("Sistemin sağlıklı çalışması için istek limitleri uygulanır.")
              }
            ]}
          />
        </div>
      </section>

      <CTASection
        title="API kullanımı hakkında destek mi gerekiyor?"
        body="Teknik ekibimiz API erişimi ve webhook akışı konusunda size yardımcı olmaya hazır."
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
            subtitle="Erişim, denetim izi ve veri yönetişimi kontrollerini kademeli olarak güçlendiren bir güvenlik yaklaşımı benimsiyoruz."
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
        primary={{ label: "İletişime geçin", href: "/contact" }}
        secondary={{ label: "Ücretsiz deneme", href: "/auth/signup", tone: "secondary" }}
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
        primary={{ label: "Ücretsiz deneme", href: "/auth/signup" }}
        secondary={{ label: "İletişime geçin", href: "/contact", tone: "secondary" }}
      />
    </PublicSiteFrame>
  );
}

export function PublicContactPage() {
  const { t } = useUiText();

  const MailSvg = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
    </svg>
  );
  const ClockSvg = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  );

  const contactDetails = [
    { Icon: MailSvg, label: t("E-posta"), value: "info@candidate.ai" },
    { Icon: ClockSvg, label: t("Çalışma saatleri"), value: t("Pazartesi - Cuma • 09:00 - 18:00") }
  ];
  const contactTopics = [
    t("Demo talebi"),
    t("Entegrasyon soruları"),
    t("Kurulum desteği")
  ];

  return (
    <PublicSiteFrame activeHref="/contact">
      {/* ═══ Hero ═══ */}
      <section className={styles.heroSectionSlim}>
        <div className={styles.shell}>
          <SectionHeader
            eyebrow={t("İletişim")}
            title={t("Size nasıl yardımcı olabiliriz?")}
            subtitle={t("İşe alım süreçlerinizi AI ile dönüştürmek mi istiyorsunuz? Sorularınızı iletin, ekibimiz en kısa sürede size dönecektir.")}
            align="center"
          />
        </div>
      </section>

      {/* ═══ Contact Form + Info ═══ */}
      <section className={styles.section}>
        <div className={cn(styles.shell, styles.contactLayout)}>
          <LeadCaptureForm
            eyebrow={null}
            title={t("Bize Mesaj Gönderin")}
            body={t("Formu doldurun; demo talebinizi, entegrasyon sorularınızı veya işe alım ihtiyacınızı birkaç cümleyle paylaşın.")}
            submitLabel={t("Mesajı Gönder")}
            sourcePage="contact"
            successTitle={t("Mesajınız ulaştı")}
            successBody={t("Ekibimiz kısa süre içinde size dönüş yapacak.")}
          />

          <div className={styles.contactInfoPanel}>
            <h3 className={styles.contactInfoTitle}>{t("Ekibimizle doğrudan bağlantı kurun")}</h3>
            <p className={styles.contactInfoBody}>
              {t("Form üzerinden gönderdiğiniz notlar doğrudan ekibimize ulaşır. Demo, entegrasyon veya işe alım süreçleriyle ilgili sorularınız için size uygun şekilde dönüş yaparız.")}
            </p>

            <div className={styles.contactMiniGrid}>
              {contactDetails.map(({ Icon, label, value }) => (
                <article key={label} className={styles.contactMiniCard}>
                  <div className={styles.contactDetailIconWrap}>
                    <Icon />
                  </div>
                  <div>
                    <span className={styles.contactMiniLabel}>{label}</span>
                    <span className={styles.contactMiniValue}>{value}</span>
                  </div>
                </article>
              ))}
            </div>

            <div className={styles.contactSupportCard}>
              <h4>{t("Yardımcı olabileceğimiz başlıklar")}</h4>
              <div className={styles.contactPillList}>
                {contactTopics.map((item) => (
                  <span key={item} className={styles.contactPill}>
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className={styles.contactSupportNote}>
              <strong>{t("Mesajınıza mümkün olduğunca hızlı döneriz.")}</strong>
              <p>
                {t("Mevcut sürecinizi ve neye ihtiyaç duyduğunuzu kısaca paylaşmanız, ilk yanıtı daha hızlı hazırlamamızı sağlar.")}
              </p>
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
  const { t } = useUiText();
  return (
    <PublicSiteFrame>
      <section className={styles.heroSection}>
        <div className={cn(styles.shell, styles.contactLayout)}>
          <div>
            <SectionHeader
              eyebrow="Ücretsiz deneme"
              title="Bekleme listesi yerine doğrudan hesap oluşturun"
              subtitle="Ücretsiz hesap oluşturun ve AI destekli işe alım platformunu hemen denemeye başlayın."
            />
            <StepsGrid
              steps={[
                { step: "01", title: "Owner hesabı", body: "İlk çalışma alanınızı ve yönetici hesabınızı birkaç dakika içinde oluşturun." },
                { step: "02", title: "Temel ayarlar", body: "Takım üyeleri, çalışma alanı ayarları ve ürün yapılandırmasını içeriden yönetin." },
                { step: "03", title: "Pilot başlangıcı", body: "İlan, aday ve mülakat akışlarını gerçek kullanım senaryolarınızla çalıştırın." },
                { step: "04", title: "Destek kanalı", body: "Ekibimiz kurulum ve onboarding sürecinde size yardımcı olmaya hazır." }
              ]}
            />
          </div>

          <div className={styles.formCard}>
            <span className={styles.eyebrow}>{t("Kayıt")}</span>
            <h3>{t("Doğrudan hesap açılışı")}</h3>
            <p>{t("Ücretsiz hesap açılışıyla AI destekli işe alım platformunu deneyebilirsiniz. Kurulum desteğinde ekibimiz yanınızda.")}</p>
            <div className={styles.tagList}>
              <span>{t("Owner hesabı")}</span>
              <span>{t("E-posta doğrulama")}</span>
              <span>{t("İlk workspace kurulumu")}</span>
            </div>
            <div className={styles.ctaActions} style={{ marginTop: 18 }}>
              <ActionLink action={{ label: t("Ücretsiz deneme"), href: "/auth/signup" }} fullWidth />
              <ActionLink
                action={{ label: t("İletişime geçin"), href: "/contact", tone: "secondary" }}
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
