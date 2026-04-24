import assert from "node:assert/strict";
import test from "node:test";
import { Recommendation } from "@prisma/client";
import { alignDecisionCopy } from "./decision-copy-alignment.utils.js";

test("alignDecisionCopy rewrites review copy when summary and action over-advance the candidate", () => {
  const result = alignDecisionCopy({
    mode: "review_pack",
    recommendation: Recommendation.REVIEW,
    summary:
      "Adayin depo operasyonlari pozisyonu icin uygun oldugu goruluyor. Kritik gereksinimlerin dogrulanmasi icin bir mulakat yapilmasi onerilir.",
    action: "Adayla mulakat yapilmasi onerilir.",
    strengths: ["Adayin iletisim becerileri guclu."],
    weaknesses: ["Role uyum ve execution seviyesi bu asamada net degil."],
    missingInformation: ["Kritik gereksinimler ayrica teyit edilmeli."]
  });

  assert.match(result.summary, /(inceleme|ilerletme karari vermeden once|net degil)/i);
  assert.match(result.action, /(manuel recruiter incelemesi|ilerletmeden once)/i);
  assert.doesNotMatch(result.summary, /uygun oldugu|mulakat yapilmasi onerilir/i);
  assert.doesNotMatch(result.action, /mulakat yapilmasi onerilir/i);
});

test("alignDecisionCopy preserves already aligned hold copy", () => {
  const result = alignDecisionCopy({
    mode: "review_pack",
    recommendation: Recommendation.HOLD,
    summary:
      "Karar icin birkac kritik nokta halen teyit bekliyor. Hedefli bir follow-up ile acik noktalar netlestikten sonra karar verin.",
    action: "Adayi recruiter incelemesinde tutun; eksik noktalar icin hedefli bir follow-up planlayin.",
    strengths: ["Aday potansiyel gosteriyor."],
    weaknesses: ["Birkaç kritik nokta teyit bekliyor."]
  });

  assert.equal(
    result.summary,
    "Karar icin birkac kritik nokta halen teyit bekliyor. Hedefli bir follow-up ile acik noktalar netlestikten sonra karar verin."
  );
  assert.equal(
    result.action,
    "Adayi recruiter incelemesinde tutun; eksik noktalar icin hedefli bir follow-up planlayin."
  );
});
