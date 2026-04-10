import test from "node:test";
import assert from "node:assert/strict";
import { transformUiText } from "./i18n";

const requiredPublicTranslations: Array<[string, string]> = [
  ["Şirket adı", "Company name"],
  ["Rol / Ekip", "Role / Team"],
  ["Mesaj", "Message"],
  ["Örn: Nurettin Erzen", "Example: Nurettin Erzen"],
  ["İK, kurucu, işe alım lideri...", "HR, founder, hiring lead..."],
  [
    "İşe alım süreçleriniz, pilot hedefiniz ve ihtiyacınız olan akışlar hakkında kısa bilgi verin.",
    "Share a short note about your hiring processes, pilot goals, and the workflows you need."
  ],
  ["Mesaj gönderilemedi. Lütfen tekrar deneyin.", "Message could not be sent. Please try again."],
  ["Gönderim başarısız oldu", "Submission failed"],
  ["Candit.ai ana sayfa", "Candit.ai home page"],
  ["Genel gezinme", "Main navigation"],
  ["Siparişim nerede?", "Where is my order?"],
  ["Gelişmiş HRIS Senkronizasyonu", "Advanced HRIS Synchronization"],
  [
    "Hiring manager çoğu zaman tüm görüşme notunu okumak istemez. Kısa özet, alıntı niteliğinde kanıtlar ve net bir karar önerisi toplantı verimini ciddi biçimde artırır.",
    "Hiring managers often do not want to read the full interview note. A short summary, quote-like evidence, and a clear decision recommendation significantly increase meeting efficiency."
  ]
];

test("public-site regression strings translate to English", () => {
  for (const [source, expected] of requiredPublicTranslations) {
    assert.equal(transformUiText(source, "en"), expected);
  }
});

test("reverse-translated public auth labels normalize to canonical Turkish", () => {
  assert.equal(transformUiText("Sign In", "tr"), "Giriş Yap");
});
