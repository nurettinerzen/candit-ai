const { test, expect } = require("@playwright/test");

const BASE = "http://localhost:3100";
const API_BASE = "http://localhost:4100/v1";

function appUrl(path) {
  const sep = path.includes("?") ? "&" : "?";
  return BASE + path + sep + "apiBase=" + encodeURIComponent(API_BASE);
}

test("sourcing home loads", async ({ page }) => {
  page.on("pageerror", (error) => console.log("PAGE_ERROR", error.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      console.log("BROWSER_CONSOLE_ERROR", msg.text());
    }
  });

  await page.goto(appUrl("/sourcing"), { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Sourcing" })).toBeVisible();
  await expect(page.getByText("Depo Operasyon Sourcing")).toBeVisible();
  await expect(page.getByText("Talent Pool Özeti")).toBeVisible();
});
