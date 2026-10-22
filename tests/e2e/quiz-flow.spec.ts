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
  expect(payload.question.id).not.toMatch(/^quick-v1-/);
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
  await expect(hostPage.getByLabel("Question style")).toHaveCount(0);
  await hostPage.getByRole("button", { name: "Create room" }).click();

  await expect(hostPage).toHaveURL(/\/game\/[A-Z0-9]{6}/);
  await expect(hostPage.getByText("Players are joining…")).toBeVisible();
  const invite = hostPage.getByRole("region", { name: "Invite players" });
  await expect(invite.locator("svg")).toBeVisible();
  const roomCode = hostPage.url().split("/").at(-1)!;
  expect(roomCode).toMatch(/^[A-Z0-9]{6}$/);
  await expect(invite.getByText(roomCode, { exact: true })).toBeVisible();
  await expect(invite.getByRole("link")).toHaveAttribute("href", new RegExp(`^http://localhost:3001/join\\?room=${roomCode}$`));

  const playerOne = await browser.newPage();
  await playerOne.goto(`/join?room=${roomCode}`);
  await expect(playerOne.getByLabel("Your name")).toBeFocused();
  await expect(playerOne.getByLabel("Your name")).toHaveValue("");
  await playerOne.getByLabel("Your name").fill("Ava");
  await playerOne.getByText("6–8", { exact: true }).click();
  await playerOne.getByRole("button", { name: "Join the game" }).click();
  await expect(playerOne).toHaveURL(new RegExp(`/game/${roomCode}$`));
  await expect(playerOne.getByText("Waiting for host…")).toBeVisible();

  const playerTwo = await browser.newPage();
  await playerTwo.goto(`/join?room=${roomCode}`);
  await playerTwo.getByLabel("Your name").fill("Noah");
  await playerTwo.getByText("12–14", { exact: true }).click();
  await playerTwo.getByRole("button", { name: "Join the game" }).click();
  await expect(playerTwo).toHaveURL(new RegExp(`/game/${roomCode}$`));
  await expect(playerTwo.getByText("Waiting for host…")).toBeVisible();

  // A device that remembers Ava offers one tap, with a way out for someone else.
  await playerOne.goto(`/join?room=${roomCode}`);
  await expect(playerOne.getByRole("button", { name: "Join as Ava · 6–8" })).toBeVisible();
  await playerOne.getByRole("button", { name: "Someone else?" }).click();
  await expect(playerOne.getByLabel("Your name")).toHaveValue("");
  await playerOne.goto(`/game/${roomCode}`);

  await hostPage.getByRole("button", { name: "Start game" }).click();
  await hostPage.getByRole("button", { name: "Start round 1" }).click();

  // The host keeps a small code for latecomers, who sit out the live round and play from the next.
  await expect(hostPage.getByRole("heading", { name: "Questions are live" })).toBeVisible();
  await expect(hostPage.getByRole("region", { name: "Invite players" }).getByText(roomCode, { exact: true })).toBeVisible();
  const latecomer = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await latecomer.goto(`/join?room=${roomCode}`);
  await latecomer.getByLabel("Your name").fill("Zoe");
  await latecomer.getByText("9–11", { exact: true }).click();
  await expect(latecomer.getByRole("button", { name: "Join the game" })).toBeInViewport();
  await latecomer.getByRole("button", { name: "Join the game" }).click();
  await expect(latecomer.getByText("You joined during this round")).toBeVisible();

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

test("a host who opens their own join link keeps host control", async ({ browser }) => {
  const hostPage = await browser.newPage();
  await hostPage.goto("/host");
  await hostPage.getByRole("button", { name: "Create room" }).click();
  await expect(hostPage).toHaveURL(/\/game\/[A-Z0-9]{6}/);
  const roomCode = hostPage.url().split("/").at(-1)!;

  await hostPage.goto(`/join?room=${roomCode}`);
  await hostPage.getByLabel("Your name").fill("Hosty");
  await hostPage.getByText("9–11", { exact: true }).click();
  await hostPage.getByRole("button", { name: "Join the game" }).click();
  await expect(hostPage.getByText("This device is hosting the room")).toBeVisible();

  await hostPage.goto(`/game/${roomCode}`);
  await expect(hostPage.getByText("host", { exact: true })).toBeVisible();
  await expect(hostPage.getByRole("button", { name: "Start game" })).toBeVisible();
});

test("a chosen answer is sent automatically when the countdown ends", async ({ browser }) => {
  const hostPage = await browser.newPage();
  await hostPage.goto("/host");
  await hostPage.getByRole("button", { name: "Create room" }).click();
  await expect(hostPage).toHaveURL(/\/game\/[A-Z0-9]{6}/);
  const roomCode = hostPage.url().split("/").at(-1)!;

  const player = await browser.newPage();
  await player.clock.install();
  await player.goto(`/join?room=${roomCode}`);
  await player.getByLabel("Your name").fill("Ava");
  await player.getByText("6–8", { exact: true }).click();
  await player.getByRole("button", { name: "Join the game" }).click();
  await expect(player.getByText("Waiting for host…")).toBeVisible();

  await hostPage.getByRole("button", { name: "Start game" }).click();
  await hostPage.getByRole("button", { name: "Start round 1" }).click();
  await expect(player.locator(".timer-pill")).toHaveText("Get ready");
  await player.getByRole("button", { name: /^A/ }).click();

  // Run the player's clock past the deadline without pressing "Lock in answer". The real deadline is far off,
  // so the host's round can only lock early because the browser sent the selected answer itself.
  await player.clock.fastForward(120_000);
  await expect(hostPage.getByRole("heading", { name: "Answers locked" })).toBeVisible();
});

