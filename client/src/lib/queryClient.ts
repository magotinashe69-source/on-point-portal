import { QueryClient, QueryFunction } from "@tanstack/react-query";

// The three portals, and what the browser remembers about who signed in to
// each one. Kept as one list so a rule below is written once, not three times.
const PORTALS = [
  { prefix: "/parent/", remembered: "onpoint-parent", login: "/parent/login" },
  { prefix: "/teacher/", remembered: "onpoint-teacher", login: "/teacher/login" },
  { prefix: "/student/", remembered: "onpoint-student", login: "/student/login" },
] as const;

// A 401 means the server-side login has ended (most often because the server
// restarted — in SQLite mode sessions are kept in memory, so a restart forgets
// everyone). The browser may still be remembering the person, which used to
// leave them on a page where everything silently failed to load. Forget the
// remembered login and send them to the login page once, so the cause is
// obvious instead of looking like missing data.
//
// This used to rescue the teacher only. A parent hit exactly the same trap and
// had it worse: their dashboard loaded, then every section — their child, the
// weekly report, the overview — showed "try again in a moment" for ever,
// because queries never retry and never go stale. Nothing sent them back to
// the login page, so there was no way out of it.
function handleExpiredLogin() {
  const path = window.location.pathname;

  // Whichever portal the person is actually in decides whose login to forget.
  // Every teacher, parent and student page lives under one of these prefixes;
  // on a shared page (the landing page, say) fall back to the teacher, which
  // is what this did before.
  const portal =
    PORTALS.find((p) => path.startsWith(p.prefix)) ??
    PORTALS.find((p) => p.prefix === "/teacher/");
  if (!portal) return;

  if (!localStorage.getItem(portal.remembered)) return;
  localStorage.removeItem(portal.remembered);
  if (!path.startsWith(portal.login)) {
    window.location.href = `${portal.login}?expired=1`;
  }
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    if (res.status === 401) handleExpiredLogin();
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Build the URL from the query key. Every string/number part after the base
    // becomes a path segment (so ["/api/students", id, "stats"] correctly hits
    // /api/students/:id/stats — numbers count, not just strings), and any object
    // part becomes the query string. This must handle numeric ids: getting it
    // wrong made the dashboard fetch the whole students list instead of a
    // student's stats, which then crashed the XP widget.
    let url = queryKey[0] as string;
    const params = new URLSearchParams();

    for (let i = 1; i < queryKey.length; i++) {
      const part = queryKey[i];
      if (part === undefined || part === null) continue;
      if (typeof part === "string" || typeof part === "number") {
        url = `${url}/${part}`;
      } else if (typeof part === "object") {
        for (const [key, value] of Object.entries(part)) {
          if (value !== undefined && value !== null) params.append(key, String(value));
        }
      }
    }
    const queryString = params.toString();
    if (queryString) url = `${url}?${queryString}`;

    const res = await fetch(url, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
