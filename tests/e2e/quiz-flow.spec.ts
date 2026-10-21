import { expect, test } from "@playwright/test";

test("solo practice uses short questions and keeps solutions hidden until answering", async ({ page }) => {
  await page.goto("/solo");
  await page.getByLabel("Username").fill(`learner${Date.now()}`);
  await page.getByLabel("Password").fill("practice-test-password");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("button", { name: "Start practice" })).toBeEnabled();
  await page.getByLabel("Age band").selectOption("6_to_8");
  const loaded = page.waitForResponse("**/api/solo/next");
  await page.getByRole("button", { name: "Start practice" }).click();
  const questionResponse = await loaded;
  expect(questionResponse.ok()).toBe(true);
  const payload = await questionResponse.json();
  expect(payload.question.id).toMatch(/^quick-v1-/);
  expect(payload.question).not.toHaveProperty("correctAnswer");
  expect(payload.question).not.toHaveProperty("explanation");
  expect(payload.ticket).toBeTruthy();
  await page.getByRole("button", { name: /^A\s/ }).click();
  const answered = page.waitForResponse("**/api/solo/answer");
  await page.getByRole("button", { name: "Lock answer" }).click();
  const answerResponse = await answered;
  expect(answerResponse.ok()).toBe(true);
  expect((await answerResponse.json()).explanation).toBeTruthy();
  await expect(page.getByRole("button", { name: /Continue/ })).toBeVisible();
  await page.getByRole("button", { name: "Flag as incorrect" }).click();
  await expect(page.getByRole("button", { name: "Flagged for review" })).toBeVisible();
});

test("host creates a room, players join, and the leaderboard updates", async ({ browser }) => {
  const hostPage = await browser.newPage();
  await hostPage.goto("/host");
  await hostPage.getByRole("button", { name: "Create room" }).click();

  await expect(hostPage).toHaveURL(/\/game\/[A-Z0-9]{6}/);
  await expect(hostPage.getByText("Players are joining…")).toBeVisible();
  await expect(hostPage.getByRole("region", { name: "Invite players" }).locator("svg")).toBeVisible();
  const roomCode = hostPage.url().split("/").at(-1);
  expect(roomCode).toBeTruthy();

  const playerOne = await browser.newPage();
  await playerOne.goto(`/join?room=${roomCode}`);
  await playerOne.getByLabel("Your name").fill("Ava");
  await playerOne.getByLabel("Age band").selectOption("6_to_8");
  await playerOne.getByRole("button", { name: "Join the game" }).click();
  await expect(playerOne).toHaveURL(new RegExp(`/game/${roomCode}$`));
  await expect(playerOne.getByText("Waiting for host…")).toBeVisible();

  const playerTwo = await browser.newPage();
  await playerTwo.goto(`/join?room=${roomCode}`);
  await playerTwo.getByLabel("Your name").fill("Noah");
  await playerTwo.getByLabel("Age band").selectOption("12_to_14");
  await playerTwo.getByRole("button", { name: "Join the game" }).click();
  await expect(playerTwo).toHaveURL(new RegExp(`/game/${roomCode}$`));
  await expect(playerTwo.getByText("Waiting for host…")).toBeVisible();

  await hostPage.getByRole("button", { name: "Start game" }).click();
  await hostPage.getByRole("button", { name: "Start round 1" }).click();

  await playerOne.getByRole("button", { name: /^A/ }).click();
  await playerOne.setViewportSize({ width: 390, height: 844 });
  await playerOne.screenshot({ path: "test-results/quick-question-mobile.png", fullPage: true });
  await playerOne.getByRole("button", { name: "Lock in answer" }).click();
  await playerTwo.getByRole("button", { name: /^A/ }).click();
  await playerTwo.getByRole("button", { name: "Lock in answer" }).click();

  await expect(hostPage.getByRole("heading", { name: "Answers locked" })).toBeVisible();
  await hostPage.getByRole("button", { name: "Reveal round" }).click();

  await expect(hostPage.getByRole("heading", { name: "Round reveal" })).toBeVisible();
  await expect(hostPage.getByText("Ava", { exact: true }).first()).toBeVisible();
  await expect(hostPage.getByText("Noah", { exact: true }).first()).toBeVisible();
  await playerOne.setViewportSize({ width: 390, height: 844 });
  await playerOne.screenshot({ path: "test-results/quick-play-mobile.png", fullPage: true });
  expect(await playerOne.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
