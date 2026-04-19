import assert from "node:assert/strict";
import test from "node:test";
import { parseBulkImportCsv } from "./csv-import";

test("parseBulkImportCsv supports quoted semicolon exports and external references", () => {
  const result = parseBulkImportCsv(
    [
      "Ad Soyad;Telefon;E-posta;Şehir;Deneyim (yıl);Başvuru No",
      "\"Ayşe, Doğan\";05321112233;ayse@example.com;İstanbul;4 yıl;KN-17"
    ].join("\n"),
    "kariyer_export.csv"
  );

  assert.equal(result.delimiter, ";");
  assert.equal(result.detectedSource, "kariyer_net");
  assert.deepEqual(result.mappedHeaders, {
    fullName: "Ad Soyad",
    phone: "Telefon",
    email: "E-posta",
    locationText: "Şehir",
    yearsOfExperience: "Deneyim (yıl)",
    externalRef: "Başvuru No"
  });
  assert.deepEqual(result.candidates, [
    {
      fullName: "Ayşe, Doğan",
      phone: "05321112233",
      email: "ayse@example.com",
      locationText: "İstanbul",
      yearsOfExperience: 4,
      externalRef: "KN-17"
    }
  ]);
});

test("parseBulkImportCsv detects tab-delimited linkedin style exports", () => {
  const result = parseBulkImportCsv(
    [
      "Candidate Name\tMobile Phone\tEmail Address\tLocation\tYears of Experience\tCandidate ID",
      "John Doe\t+1 202 555 0101\tjohn@example.com\tRemote\t5+\tLI-99"
    ].join("\n"),
    "linkedin_candidates.tsv"
  );

  assert.equal(result.delimiter, "\t");
  assert.equal(result.detectedSource, "linkedin");
  assert.equal(result.candidates[0]?.yearsOfExperience, 5);
  assert.equal(result.candidates[0]?.externalRef, "LI-99");
});

test("parseBulkImportCsv returns no candidates when no name-like column exists", () => {
  const result = parseBulkImportCsv(
    [
      "Telefon;E-posta;Lokasyon",
      "05321112233;ayse@example.com;İstanbul"
    ].join("\n")
  );

  assert.equal(result.candidates.length, 0);
  assert.equal(result.mappedHeaders.fullName, null);
});
