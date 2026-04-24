import assert from "node:assert/strict";
import test from "node:test";
import { RecommendationGenerationTaskService } from "./recommendation-generation-task.service.js";

test("sanitizeSections strips repeated risk lines and rewrites generic recommendation summary", () => {
  const service = new RecommendationGenerationTaskService({} as never, {} as never, {} as never);

  const result = (service as any).sanitizeSections({
    facts: [
      "CV ozeti: adayin liderlik deneyimi var.",
      "Aday teslim tarihi baskisinda zorlandigini kabul etti."
    ],
    interpretation: [
      "Aday teslim tarihi baskisinda zorlandigini kabul etti.",
      "Fit score baglami bu profili guclu gosteriyor."
    ],
    interviewSummary: "Aday teslim tarihi baskisinda zorlandigini kabul etti.",
    strengths: ["Sakin iletisim kurdu."],
    weaknesses: ["Teslim baskisinda execution ornekleri zayif kaldi."],
    recommendationSummary: "Recruiter degerlendirmesi gerekir.",
    recommendationAction: "Ek gorusme planla.",
    recommendedOutcome: "REVIEW",
    flags: [
      {
        code: "EXECUTION_RISK",
        severity: "medium",
        note: "Teslim baskisinda execution ornekleri zayif kaldi."
      }
    ],
    missingInformation: [
      "Teslim baskisinda execution ornekleri zayif kaldi.",
      "Benzer deadline ortaminda nasil onceliklendirdigi ayrica sorulmali."
    ],
    evidenceLinks: [],
    confidence: 0.58,
    uncertaintyReasons: ["Gorusmede sinirli ornek verildi."]
  });

  assert.equal(result.facts.some((line: string) => /cv ozeti/i.test(line)), false);
  assert.equal(
    result.interpretation.some((line: string) => /fit score baglami/i.test(line)),
    false
  );
  assert.equal(
    result.missingInformation.includes("Teslim baskisinda execution ornekleri zayif kaldi."),
    false
  );
  assert.notEqual(result.recommendationSummary, "Recruiter degerlendirmesi gerekir.");
  assert.match(result.recommendationSummary, /(inceleme|ilerletmeden once|manuel)/i);
});

test("loadRubric prefers fit scoring rubric for recommendation quality context", async () => {
  const queries: Array<Record<string, unknown>> = [];
  const service = new RecommendationGenerationTaskService(
    {
      aiTaskRun: {
        findUnique: async () => ({
          rubricId: null
        })
      },
      scoringRubric: {
        findFirst: async (query: Record<string, unknown>) => {
          queries.push(query);
          const where = query.where as { key?: { startsWith?: string } };

          if (where.key?.startsWith === "fit_scoring_") {
            return {
              id: "rubric_fit_warehouse_v1",
              key: "fit_scoring_warehouse"
            };
          }

          return {
            id: "rubric_warehouse_v1",
            key: "warehouse_screening"
          };
        }
      }
    } as never,
    {} as never,
    {} as never
  );

  const rubric = await (service as any).loadRubric("ten_1", "run_1", "warehouse");

  assert.equal(rubric.key, "fit_scoring_warehouse");
  assert.equal(
    (queries[0]?.where as { key?: { startsWith?: string } }).key?.startsWith,
    "fit_scoring_"
  );
});
