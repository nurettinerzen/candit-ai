import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { IntegrationProvider } from "@prisma/client";
import { SchedulingService } from "./scheduling.service";

function createService() {
  let applicationExists = true;
  let schedulingWorkflowCreateCalls = 0;
  let capturedProviderCheck: Record<string, unknown> | null = null;
  let providerCheckError: Error | null = null;

  const service = new SchedulingService(
    {
      candidateApplication: {
        findFirst: async () => (applicationExists ? { id: "app_1" } : null)
      },
      schedulingWorkflow: {
        create: async (input: { data: Record<string, unknown> }) => {
          schedulingWorkflowCreateCalls += 1;
          return {
            id: "workflow_1",
            ...input.data
          };
        }
      }
    } as never,
    {} as never,
    {
      assertMeetingProviderSelectable: async (input: Record<string, unknown>) => {
        capturedProviderCheck = input;
        if (providerCheckError) {
          throw providerCheckError;
        }
        return {
          provider: input.provider,
          selectable: true
        };
      }
    } as never,
    {
      write: async () => undefined
    } as never,
    {
      append: async () => undefined
    } as never
  );

  return {
    service,
    setApplicationExists(value: boolean) {
      applicationExists = value;
    },
    setProviderCheckError(error: Error | null) {
      providerCheckError = error;
    },
    getCapturedProviderCheck() {
      return capturedProviderCheck;
    },
    getSchedulingWorkflowCreateCalls() {
      return schedulingWorkflowCreateCalls;
    }
  };
}

test("createWorkflow rejects missing applications before provider setup", async () => {
  const { service, setApplicationExists, getSchedulingWorkflowCreateCalls } = createService();
  setApplicationExists(false);

  await assert.rejects(
    () =>
      service.createWorkflow({
        tenantId: "ten_1",
        applicationId: "missing_app",
        initiatedBy: "usr_1",
        provider: IntegrationProvider.GOOGLE_CALENDAR
      }),
    (error: unknown) => error instanceof NotFoundException
  );

  assert.equal(getSchedulingWorkflowCreateCalls(), 0);
});

test("createWorkflow enforces provider selectability before creating the workflow", async () => {
  const { service, setProviderCheckError, getCapturedProviderCheck, getSchedulingWorkflowCreateCalls } =
    createService();

  setProviderCheckError(
    new BadRequestException("GOOGLE_CALENDAR için aktif tenant baglantisi bulunmuyor.")
  );

  await assert.rejects(
    () =>
      service.createWorkflow({
        tenantId: "ten_1",
        applicationId: "app_1",
        initiatedBy: "usr_1",
        provider: IntegrationProvider.GOOGLE_CALENDAR
      }),
    (error: unknown) =>
      error instanceof BadRequestException &&
      error.message.includes("GOOGLE_CALENDAR için aktif tenant baglantisi bulunmuyor")
  );

  assert.deepEqual(getCapturedProviderCheck(), {
    tenantId: "ten_1",
    provider: IntegrationProvider.GOOGLE_CALENDAR
  });
  assert.equal(getSchedulingWorkflowCreateCalls(), 0);
});
