import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { CandidatesService } from "./candidates.service";

function createService(existingCandidate: Record<string, unknown>) {
  const audits: Array<Record<string, unknown>> = [];
  let updateCalls = 0;
  let lastUpdateInput: { where: Record<string, unknown>; data: Record<string, unknown> } | null = null;

  const prisma = {
    candidate: {
      findFirst: async () => existingCandidate,
      update: async (input: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        updateCalls += 1;
        lastUpdateInput = input;
        return {
          ...existingCandidate,
          ...input.data
        };
      },
      create: async () => {
        throw new Error("create should not be called in duplicate candidate tests");
      }
    }
  };

  const auditWriter = {
    write: async (input: Record<string, unknown>) => {
      audits.push(input);
      return {
        id: `audit_${audits.length}`
      };
    }
  };

  const service = new CandidatesService(
    prisma as never,
    auditWriter as never,
    { append: async () => undefined } as never,
    {} as never,
    {} as never
  );

  return {
    service,
    audits,
    getUpdateCalls: () => updateCalls,
    getLastUpdateInput: () => lastUpdateInput
  };
}

test("create enriches missing source metadata when a duplicate candidate is imported", async () => {
  const existingCandidate = {
    id: "cand_1",
    tenantId: "ten_1",
    fullName: "Ayse Yilmaz",
    email: "ayse@example.com",
    phone: null,
    source: null,
    locationText: null,
    yearsOfExperience: null,
    externalRef: null,
    externalSource: null
  };
  const { service, audits, getUpdateCalls, getLastUpdateInput } = createService(existingCandidate);

  const result = await service.create({
    tenantId: "ten_1",
    createdBy: "usr_1",
    fullName: "Ayse Yilmaz",
    email: "Ayse@example.com",
    phone: "+90 555 123 45 67",
    source: " kariyer_net ",
    locationText: " Istanbul ",
    yearsOfExperience: 4,
    externalRef: " export-row-17 ",
    externalSource: " Kariyer.net "
  });

  assert.equal(result.deduplicated, true);
  assert.deepEqual(result.enrichedFields, [
    "phone",
    "source",
    "locationText",
    "yearsOfExperience",
    "externalRef",
    "externalSource"
  ]);
  assert.equal(getUpdateCalls(), 1);
  assert.deepEqual(getLastUpdateInput(), {
    where: {
      id: "cand_1"
    },
    data: {
      phone: "905551234567",
      source: "kariyer_net",
      locationText: "Istanbul",
      yearsOfExperience: new Prisma.Decimal(4),
      externalRef: "export-row-17",
      externalSource: "Kariyer.net"
    }
  });
  assert.equal(result.candidate.phone, "905551234567");
  assert.equal(audits.length, 1);
  assert.deepEqual(audits[0]?.metadata, {
    fullName: "Ayse Yilmaz",
    email: "ayse@example.com",
    phone: "905551234567",
    source: "kariyer_net",
    externalSource: "Kariyer.net",
    externalRef: "export-row-17",
    enrichedFields: [
      "phone",
      "source",
      "locationText",
      "yearsOfExperience",
      "externalRef",
      "externalSource"
    ]
  });
});

test("create does not overwrite existing provenance fields on duplicate candidates", async () => {
  const existingCandidate = {
    id: "cand_2",
    tenantId: "ten_1",
    fullName: "Mehmet Kaya",
    email: "mehmet@example.com",
    phone: "905321112233",
    source: "linkedin",
    locationText: "Ankara",
    yearsOfExperience: new Prisma.Decimal(6),
    externalRef: "ln-1",
    externalSource: "LinkedIn"
  };
  const { service, audits, getUpdateCalls } = createService(existingCandidate);

  const result = await service.create({
    tenantId: "ten_1",
    createdBy: "usr_1",
    fullName: "Mehmet Kaya",
    email: "mehmet@example.com",
    phone: "+90 530 000 00 00",
    source: "kariyer_net",
    locationText: "Istanbul",
    yearsOfExperience: 2,
    externalRef: "kn-99",
    externalSource: "Kariyer.net"
  });

  assert.equal(result.deduplicated, true);
  assert.deepEqual(result.enrichedFields, []);
  assert.equal(getUpdateCalls(), 0);
  assert.equal(result.candidate.source, "linkedin");
  assert.equal(result.candidate.externalSource, "LinkedIn");
  assert.equal(audits.length, 1);
  assert.deepEqual(audits[0]?.metadata, {
    fullName: "Mehmet Kaya",
    email: "mehmet@example.com",
    phone: "905300000000",
    source: "kariyer_net",
    externalSource: "Kariyer.net",
    externalRef: "kn-99",
    enrichedFields: []
  });
});
