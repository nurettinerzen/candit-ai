import test from "node:test";
import assert from "node:assert/strict";
import { resolveSourceValue } from "../components/site-language-provider";

test("resolveSourceValue keeps React-localized text when cached source is stale", () => {
  assert.equal(
    resolveSourceValue({
      cachedSource: "Her",
      currentValue: "Hundreds",
      locale: "en",
      previousLocale: "tr"
    }),
    "Hundreds"
  );
});

test("resolveSourceValue keeps cached source when DOM still reflects previous locale", () => {
  assert.equal(
    resolveSourceValue({
      cachedSource: "Her gün yüzlerce CV inceleniyor ama doğru adayı bulmak imkansız hissettiriyor. Candit bunu değiştiriyor.",
      currentValue: "Her gün yüzlerce CV inceleniyor ama doğru adayı bulmak imkansız hissettiriyor. Candit bunu değiştiriyor.",
      locale: "en",
      previousLocale: "tr"
    }),
    "Her gün yüzlerce CV inceleniyor ama doğru adayı bulmak imkansız hissettiriyor. Candit bunu değiştiriyor."
  );
});
