// Getting the server's own words back out of a failed apiRequest.
//
// apiRequest() throws on any non-2xx response, with a message shaped
// `"400: {\"success\":false,\"message\":\"...\"}"` — the status, then the raw
// body. That is fine for a request that either works or has broken, but it is
// wrong for one that can be REFUSED for a good reason the teacher needs to
// read: a validation failure comes back as 400, and catching it as "check your
// connection" tells somebody their internet is down when the real problem is
// that they forgot to mark which option is correct.
//
// So this digs the message back out. It never throws: whatever it is handed, it
// returns something worth showing.

export function apiErrorMessage(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");

  // "400: {json}" — take everything after the first colon and try it as JSON.
  const at = raw.indexOf(":");
  const body = at >= 0 ? raw.slice(at + 1).trim() : raw.trim();

  if (body.startsWith("{")) {
    try {
      const parsed = JSON.parse(body);
      if (typeof parsed?.message === "string" && parsed.message.trim()) {
        return parsed.message;
      }
    } catch {
      // Not JSON after all — fall through to the fallback below.
    }
  }

  // A network failure has no body at all, which is the case the fallback is
  // actually written for.
  return fallback;
}
