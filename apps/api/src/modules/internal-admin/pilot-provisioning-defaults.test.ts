import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_PILOT_WORKSPACE_NAME,
  ensurePilotWorkspaceAndAiDefaults
} from "./pilot-provisioning-defaults";

test("ensurePilotWorkspaceAndAiDefaults provisions workspace plus AI prompt and rubric defaults", async () => {
  const workspaceCalls: Array<Record<string, unknown>> = [];
  const promptCalls: Array<Record<string, unknown>> = [];
  const rubricCalls: Array<Record<string, unknown>> = [];

  await ensurePilotWorkspaceAndAiDefaults(
    {
      workspace: {
        upsert: async (query: Record<string, unknown>) => {
          workspaceCalls.push(query);
          return query;
        }
      },
      aiPromptTemplate: {
        upsert: async (query: Record<string, unknown>) => {
          promptCalls.push(query);
          return query;
        }
      },
      scoringRubric: {
        upsert: async (query: Record<string, unknown>) => {
          rubricCalls.push(query);
          return query;
        }
      }
    } as never,
    "ten_pilot"
  );

  assert.equal(workspaceCalls.length, 1);
  assert.deepEqual(workspaceCalls[0]?.where, {
    tenantId_name: {
      tenantId: "ten_pilot",
      name: DEFAULT_PILOT_WORKSPACE_NAME
    }
  });
  assert.equal(promptCalls.length, 4);
  assert.equal(rubricCalls.length, 4);
  assert.equal(
    promptCalls.some(
      (call) =>
        (call.where as { tenantId_key_version?: { key?: string } }).tenantId_key_version?.key ===
        "report_generation_tr_v1"
    ),
    true
  );
  assert.equal(
    rubricCalls.some(
      (call) =>
        (call.where as { tenantId_key_version?: { key?: string } }).tenantId_key_version?.key ===
        "fit_scoring_warehouse"
    ),
    true
  );
});
