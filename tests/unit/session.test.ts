import { vi } from "vitest";

const jar = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { value: jar.get(name) } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
  }),
}));
import { getRoomSessionKey, setRoomSessionKey } from "@/lib/game/session";

describe("room session cookies", () => {
  beforeEach(() => jar.clear());

  it("keeps host and player credentials apart, so joining never overwrites host control", async () => {
    await setRoomSessionKey("ABC123", "host-key", "host");
    await setRoomSessionKey("ABC123", "player-key", "player");
    expect(jar.get("witzy_host_abc123")).toBe("host-key");
    expect(jar.get("witzy_abc123")).toBe("player-key");
    expect(await getRoomSessionKey("ABC123")).toBe("host-key");
    expect(await getRoomSessionKey("ZZZ999")).toBeNull();
  });

  it("acts as the player on a device that only joined, and still honours cookies set before the split", async () => {
    await setRoomSessionKey("ABC123", "player-key", "player");
    expect(await getRoomSessionKey("ABC123")).toBe("player-key");
    jar.set("witzy_xyz789", "legacy-host-key");
    expect(await getRoomSessionKey("XYZ789")).toBe("legacy-host-key");
  });
});
