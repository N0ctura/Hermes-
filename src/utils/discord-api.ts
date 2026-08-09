export function setDiscordClient(client: any): void {
  (globalThis as any).__hermesDiscordClient = client;
}

export function getDiscordClient(): any | null {
  return (globalThis as any).__hermesDiscordClient ?? null;
}
