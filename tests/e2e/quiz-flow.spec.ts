import { expect, test } from "@playwright/test";

test("host creates a room, players join, and the leaderboard updates", async ({ browser }) => {
  const hostPage = await browser.newPage();
  await hostPage.goto("/host");
  await hostPage.getByRole("button", { name: "Create room" }).click();

  await expect(hostPage).toHaveURL(/\/game\/[A-Z0-9]{6}/);
  await expect(hostPage.getByText("Players are joining the lobby")).toBeVisible();
  const roomCode = hostPage.url().split("/").at(-1);
  expect(roomCode).toBeTruthy();

  const playerOne = await browser.newPage();
  await playerOne.goto(`/join?room=${roomCode}`);
  await playerOne.getByLabel("Display name").fill("Ava");
  await playerOne.getByRole("button", { name: "Join the game" }).click();
  await expect(playerOne).toHaveURL(new RegExp(`/game/${roomCode}$`));
  await expect(playerOne.getByText("Waiting for the host to begin")).toBeVisible();

  const playerTwo = await browser.newPage();
  await playerTwo.goto(`/join?room=${roomCode}`);
  await playerTwo.getByLabel("Display name").fill("Noah");
  await playerTwo.getByRole("button", { name: "Join the game" }).click();
  await expect(playerTwo).toHaveURL(new RegExp(`/game/${roomCode}$`));
  await expect(playerTwo.getByText("Waiting for the host to begin")).toBeVisible();

  await hostPage.getByRole("button", { name: "Start game" }).click();
  await expect(hostPage.getByRole("button", { name: "Start next round" })).toBeVisible();
  await hostPage.getByRole("button", { name: "Start next round" }).click();

  await playerOne.getByRole("button", { name: /^A/ }).click();
  await playerOne.getByRole("button", { name: "Lock in answer" }).click();
  await playerTwo.getByRole("button", { name: /^A/ }).click();
  await playerTwo.getByRole("button", { name: "Lock in answer" }).click();

  await expect(hostPage.getByText("Answers are locked")).toBeVisible();
  await hostPage.getByRole("button", { name: "Reveal round" }).click();

  await expect(hostPage.getByText("Public standings")).toBeVisible();
  await expect(hostPage.getByText("#1 Ava")).toBeVisible();
  await expect(hostPage.getByText("Noah", { exact: true })).toBeVisible();
});
