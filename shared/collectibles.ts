// The Treasure Hunt collectibles.
//
// This is plain data only — a fixed list of the 12 items a student can collect.
// It lives in `shared/` so both the server (to award them) and the client
// (to display them later) can use the exact same list. No logic here.

export interface Collectible {
  name: string;        // shown on the collectible card
  description: string; // a short, fun one-liner
}

// The 12 items in the Treasure Hunt set. Order is not important.
export const COLLECTIBLES: Collectible[] = [
  { name: "Ruby Gem",           description: "A blood-red jewel that glows in the dark. Worth a small fortune!" },
  { name: "Golden Compass",     description: "Always points to the nearest treasure — never to home." },
  { name: "Old Map Piece",      description: "One torn corner of a much bigger secret." },
  { name: "Parrot",             description: "Repeats every secret you say — loudly, at the worst moment." },
  { name: "Pearl",              description: "Plucked from the deepest oyster in the seven seas." },
  { name: "Anchor",             description: "Heavy, rusty and stubborn — just like the old captain." },
  { name: "Spyglass",           description: "Spot a storm long before the rest of the crew does." },
  { name: "Treasure Key",       description: "Opens one chest, somewhere. Good luck finding it!" },
  { name: "Silver Coin",        description: "Ping it on the table to hear the ring of real silver." },
  { name: "Message in a Bottle", description: "A soggy note from a sailor who never made it back." },
  { name: "Pirate Flag",        description: "Black cloth, white bones. Raise it and enemies flee." },
  { name: "Crown",              description: "Borrowed from a king who wasn't watching — fit for a pirate lord." },
];

// Handy count for anywhere that needs to show "x of 12 collected".
export const TREASURE_HUNT_TOTAL = COLLECTIBLES.length;
