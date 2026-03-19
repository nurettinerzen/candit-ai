"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";
import { AUTH_SESSION_MODE } from "../../../lib/auth/runtime";
import { loginWithPassword } from "../../../lib/auth/session";

export default function LoginPage() {
  const router = useRouter();
  const [tenantId, setTenantId] = useState("ten_demo");
  const [email, setEmail] = useState("recruiter@demo.local");
  const [password, setPassword] = useState("demo12345");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      await loginWithPassword({
        tenantId,
        email,
        password
      });

      router.push("/");
      router.refresh();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Giriş başarısız.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 460, margin: "40px auto", padding: 16 }}>
      <h1 style={{ marginBottom: 8 }}>Oturum Aç</h1>
      <p style={{ marginTop: 0, color: "#666" }}>
        Aktif auth modu: <strong>{AUTH_SESSION_MODE}</strong>
      </p>

      <form onSubmit={handleSubmit} className="panel">
        <label className="field">
          <span className="small">Tenant ID</span>
          <input value={tenantId} onChange={(event) => setTenantId(event.target.value)} required />
        </label>
        <label className="field">
          <span className="small">E-posta</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label className="field">
          <span className="small">Şifre</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        {error ? <p style={{ color: "#c2410c", marginBottom: 8 }}>{error}</p> : null}

        <button type="submit" className="button-link" disabled={loading}>
          {loading ? "Giriş yapılıyor..." : "Giriş yap"}
        </button>
      </form>

      <p style={{ marginTop: 14 }}>
        Recruiter panele dönmek için <Link href="/">buraya</Link> tıklayın.
      </p>
    </main>
  );
}
