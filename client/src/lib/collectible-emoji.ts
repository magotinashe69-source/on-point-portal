// A little picture for each Treasure Hunt collectible. This is display-only, so
// it lives on the client (not in the shared data). Both the island map and the
// reward pop-up use this one lookup so a treasure always looks the same.
export const COLLECTIBLE_EMOJI: Record<string, string> = {
  "Ruby Gem": "💎",
  "Golden Compass": "🧭",
  "Old Map Piece": "🗺️",
  "Parrot": "🦜",
  "Pearl": "🦪",
  "Anchor": "⚓",
  "Spyglass": "🔭",
  "Treasure Key": "🗝️",
  "Silver Coin": "🪙",
  "Message in a Bottle": "📜",
  "Pirate Flag": "🏴‍☠️",
  "Crown": "👑",
};

// The emoji for a treasure by name, with a friendly fallback if it's unknown.
export function collectibleEmoji(name: string): string {
  return COLLECTIBLE_EMOJI[name] ?? "🎁";
}
