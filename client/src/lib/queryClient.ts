import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
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
