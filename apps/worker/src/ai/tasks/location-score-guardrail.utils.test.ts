import assert from "node:assert/strict";
import test from "node:test";
import { guardLocationCategoryScore } from "./location-score-guardrail.utils.js";

test("guardLocationCategoryScore protects same-city strong commute-open candidates from over-penalized AI location scores", () => {
  const score = guardLocationCategoryScore({
    aiScore: 70,
    deterministicScore: 92,
    presenceMode: "hybrid",
    candidateFlexibility: "commute_open",
    mismatchLevel: "same_city",
    commuteSeverity: "light"
  });

  assert.equal(score, 84);
});

test("guardLocationCategoryScore keeps same-locality candidates near deterministic location confidence", () => {
  const score = guardLocationCategoryScore({
    aiScore: 73,
    deterministicScore: 95,
    presenceMode: "hybrid",
    candidateFlexibility: "unknown",
    mismatchLevel: "same_locality",
    commuteSeverity: "minimal"
  });

  assert.equal(score, 91);
});

test("guardLocationCategoryScore does not override remote-only or remote-mode penalties", () => {
  const remoteOnlyScore = guardLocationCategoryScore({
    aiScore: 38,
    deterministicScore: 88,
    presenceMode: "hybrid",
    candidateFlexibility: "remote_only",
    mismatchLevel: "same_city",
    commuteSeverity: "light"
  });
  const remoteRoleScore = guardLocationCategoryScore({
    aiScore: 44,
    deterministicScore: 90,
    presenceMode: "remote",
    candidateFlexibility: "commute_open",
    mismatchLevel: "same_city",
    commuteSeverity: "light"
  });

  assert.equal(remoteOnlyScore, 38);
  assert.equal(remoteRoleScore, 44);
});
