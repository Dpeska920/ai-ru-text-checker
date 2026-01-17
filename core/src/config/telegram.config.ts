function parseList(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(",").map(s => s.trim()).filter(Boolean);
}

function parseNumberList(value: string | undefined): number[] {
  return parseList(value)
    .map(s => parseInt(s, 10))
    .filter(n => !isNaN(n));
}

export const TELEGRAM = {
  TOKEN: process.env.TG_TOKEN || "",
  WHITELIST_IDS: parseNumberList(process.env.TG_WHITELIST_IDS),
  WHITELIST_USERNAMES: parseList(process.env.TG_WHITELIST_USERNAMES).map(u => u.toLowerCase().replace(/^@/, "")),
};

if (!TELEGRAM.TOKEN) {
  console.warn("Warning: TG_TOKEN is not set");
}

const hasWhitelist = TELEGRAM.WHITELIST_IDS.length > 0 || TELEGRAM.WHITELIST_USERNAMES.length > 0;
if (hasWhitelist) {
  console.log(`Whitelist enabled: ${TELEGRAM.WHITELIST_IDS.length} IDs, ${TELEGRAM.WHITELIST_USERNAMES.length} usernames`);
} else {
  console.warn("Warning: No whitelist configured, bot is open to everyone");
}
