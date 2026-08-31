// Working out how a lesson should be played.
//
// Most lessons are a file the teacher uploaded or recorded, which a plain
// <video>/<audio> tag can play. A YouTube link is different: the file itself is
// not reachable, so it has to go through YouTube's own embedded player.

/**
 * A YouTube video id is always 11 characters of this alphabet. Matching it
 * exactly matters for safety as well as correctness: the embed address is built
 * from the id we extract, never from the address the teacher typed, so nothing
 * from the pasted text can end up steering the iframe somewhere else.
 */
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

const YOUTUBE_HOSTS = [
  "youtube.com", "www.youtube.com", "m.youtube.com",
  "youtu.be", "www.youtu.be",
  "youtube-nocookie.com", "www.youtube-nocookie.com",
];

/** The id of the video a YouTube address points at, or null if it is not one. */
export function youtubeVideoId(rawUrl: string): string | null {
  const trimmed = (rawUrl || "").trim();
  if (trimmed === "") return null;

  let url: URL;
  try {
    // A bare "youtu.be/abc" with no scheme is still worth understanding.
    url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  // Only ever http(s) — this guards against a "javascript:" address reaching
  // the player through a pasted list.
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!YOUTUBE_HOSTS.includes(url.hostname.toLowerCase())) return null;

  const segments = url.pathname.split("/").filter(Boolean);
  const candidate =
    url.searchParams.get("v")                                  // /watch?v=ID
    ?? (segments[0] === "embed" || segments[0] === "shorts" || segments[0] === "live"
          ? segments[1]                                        // /embed/ID, /shorts/ID
          : segments.length === 1 ? segments[0] : undefined);  // youtu.be/ID

  return candidate && VIDEO_ID.test(candidate) ? candidate : null;
}

/** True when this lesson should be shown through YouTube's player. */
export function isYouTubeLesson(fileUrl: string): boolean {
  return youtubeVideoId(fileUrl) !== null;
}

/**
 * The address to put in the iframe. Built from the extracted id only.
 *
 * youtube-nocookie.com is YouTube's own privacy-preserving host: it does not
 * set tracking cookies unless the video is actually played. This is a school
 * app used by children, so it is the right default.
 */
export function youtubeEmbedUrl(fileUrl: string): string | null {
  const id = youtubeVideoId(fileUrl);
  return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0` : null;
}
