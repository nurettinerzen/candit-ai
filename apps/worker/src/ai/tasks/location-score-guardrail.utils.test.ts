import assert from "node:assert/strict";
import test from "node:test";
import { guardLocationCategoryScore } from "./location-score-guardrail.utils.js";

test("guardLocationCategoryScore keeps same-city candidates AI-first but inside a sane band", () => {
  const score = guardLocationCategoryScore({
    aiScore: 70,
    deterministicScore: 92,
    presenceMode: "hybrid",
    candidateFlexibility: "commute_open",
    mismatchLevel: "same_city",
    commuteSeverity: "light"
  });

  assert.equal(score, 82);
});

test("guardLocationCategoryScore protects same-locality matches from overly low AI scores", () => {
  const score = guardLocationCategoryScore({
    aiScore: 73,
    deterministicScore: 95,
    presenceMode: "hybrid",
    candidateFlexibility: "unknown",
    mismatchLevel: "same_locality",
    commuteSeverity: "minimal"
  });

  assert.equal(score, 88);
});

test("guardLocationCategoryScore still allows cross-city AI variation but blocks absurd extremes", () => {
  const penalizedTooHard = guardLocationCategoryScore({
    aiScore: 0,
    deterministicScore: 24,
    presenceMode: "onsite",
    candidateFlexibility: "unknown",
    mismatchLevel: "cross_city",
    commuteSeverity: "severe"
  });
  const rewardedTooMuch = guardLocationCategoryScore({
    aiScore: 58,
    deterministicScore: 24,
    presenceMode: "onsite",
    candidateFlexibility: "unknown",
    mismatchLevel: "cross_city",
    commuteSeverity: "severe"
  });

  assert.equal(penalizedTooHard, 14);
  assert.equal(rewardedTooMuch, 34);
});

test("guardLocationCategoryScore keeps remote roles AI-first without collapsing the score", () => {
  const remoteRoleScore = guardLocationCategoryScore({
    aiScore: 44,
    deterministicScore: 90,
    presenceMode: "remote",
    candidateFlexibility: "commute_open",
    mismatchLevel: "same_city",
    commuteSeverity: "light"
  });

  assert.equal(remoteRoleScore, 80);
});
