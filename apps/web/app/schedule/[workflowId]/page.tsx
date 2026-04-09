"use client";

import Link from "next/link";

export default function LegacySchedulingPage() {
  return (
    <main>
      <section className="candidate-shell" style={{ maxWidth: 640 }}>
        <header className="candidate-header">
          <p className="eyebrow">Candit.ai</p>
          <h1 style={{ margin: "8px 0 6px" }}>Planlama Yerine Doğrudan Görüşme</h1>
          <p className="small" style={{ marginTop: 0 }}>
            AI ön görüşme akışı artık slot seçimi gerektirmiyor. Güncel davetlerde adaylar tek bir görüşme linkiyle, geçerlilik süresi içinde istedikleri an başlayabilir.
          </p>
        </header>

        <section className="panel">
          <h3 style={{ marginTop: 0 }}>Bu sayfa neden görünüyor?</h3>
          <p className="small" style={{ marginBottom: 0 }}>
            Elinizdeki bağlantı önceki planlama akışından kalmış olabilir. Güncel AI ön görüşme süreci için e-postadaki doğrudan görüşme linkini kullanın veya recruiter ekibinden yeni davet isteyin.
          </p>
        </section>

        <section className="panel" style={{ marginTop: 12 }}>
          <div className="row-actions">
            <Link href="/auth/login" className="ghost-button" style={{ textDecoration: "none" }}>
              Panele Dön
            </Link>
          </div>
        </section>
      </section>
    </main>
  );
}
