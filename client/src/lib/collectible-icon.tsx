// A little picture for each Treasure Hunt collectible. This is display-only, so
// it lives on the client (not in the shared data). Both the island map and the
// reward pop-up use this one lookup so a treasure always looks the same.
//
// These were emoji until the copy pass; spec S6 allows Lucide only, so each
// treasure now has the Lucide icon closest to what it is.
import {
  Anchor, Bird, Coins, Compass, Crown, Flag, Gem, KeyRound,
  Map, Scroll, Shell, Telescope, Gift,
  type LucideIcon,
} from "lucide-react";

export const COLLECTIBLE_ICON: Record<string, LucideIcon> = {
  "Ruby Gem": Gem,
  "Golden Compass": Compass,
  "Old Map Piece": Map,
  "Parrot": Bird,
  "Pearl": Shell,
  "Anchor": Anchor,
  "Spyglass": Telescope,
  "Treasure Key": KeyRound,
  "Silver Coin": Coins,
  "Message in a Bottle": Scroll,
  "Pirate Flag": Flag,
  "Crown": Crown,
};

// The icon for a treasure by name, with a plain fallback if it's unknown.
export function collectibleIcon(name: string): LucideIcon {
  return COLLECTIBLE_ICON[name] ?? Gift;
}
