/** Calls an admin route that changes something; resolves to the error to show, or null when it worked. */
export async function callAdmin(url: string, method: "POST" | "DELETE", body?: unknown): Promise<string | null> {
  try {
    const response = await fetch(url, {
      method,
      ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    });
    if (response.ok) return null;
    const answer = (await response.json().catch(() => null)) as { error?: string } | null;
    return answer?.error ?? `The server answered ${response.status}.`;
  } catch {
    return "Couldn't reach the server.";
  }
}
