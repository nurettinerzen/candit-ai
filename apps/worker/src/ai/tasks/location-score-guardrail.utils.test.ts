import assert from "node:assert/strict";
import test from "node:test";
import { guardLocationCategoryScore } from "./location-score-guardrail.utils.js";

test("guardLocationCategoryScore always preserves deterministic location score", () => {
  const score = guardLocationCategoryScore({
    aiScore: 70,
    deterministicScore: 92,
    presenceMode: "hybrid",
    candidateFlexibility: "commute_open",
    mismatchLevel: "same_city",
    commuteSeverity: "light"
  });

  assert.equal(score, 92);
});

test("guardLocationCategoryScore keeps same-locality candidates fully deterministic", () => {
  const score = guardLocationCategoryScore({
    aiScore: 73,
    deterministicScore: 95,
    presenceMode: "hybrid",
    candidateFlexibility: "unknown",
    mismatchLevel: "same_locality",
    commuteSeverity: "minimal"
  });

  assert.equal(score, 95);
});

test("guardLocationCategoryScore ignores arbitrary AI variation for remote-only or remote roles too", () => {
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

  assert.equal(remoteOnlyScore, 88);
  assert.equal(remoteRoleScore, 90);
});
