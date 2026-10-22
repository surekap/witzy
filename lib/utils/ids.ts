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
