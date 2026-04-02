export function createId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function createSessionKey() {
  return crypto.randomUUID();
}

export function createRoomCode() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

export function stableIndex(seed: string, length: number) {
  if (length <= 0) {
    return 0;
  }

  let total = 0;
  for (const character of seed) {
    total = (total * 31 + character.charCodeAt(0)) % 1_000_003;
  }

  return total % length;
}
