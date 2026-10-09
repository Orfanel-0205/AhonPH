/**
 * What the phone tells the user for each status code from the laptop hub (troubleshooting by status
 * code: 4xx means fix the request on this side, 5xx means the laptop has a problem).
 */
export function hubErrorMessage(status: number, serverMessage?: string, retryAfterSeconds?: number): string {
  switch (status) {
    case 400:
      return serverMessage || "The laptop hub couldn't understand the request.";
    case 401:
      return "The laptop hub needs the team access key: AI Lab → Team laptop AI.";
    case 403:
      return "This access key isn't allowed to do that.";
    case 404:
      return "The laptop hub doesn't have that feature. Update the hub on the laptop.";
    case 413:
      return "That's too big to send to the laptop. Try a smaller photo.";
    case 415:
      return "The app sent the wrong format. Update the app.";
    case 429:
      return `The laptop is busy with the team's requests. Try again in ${retryAfterSeconds ?? "a few"} seconds.`;
    case 502:
    case 503:
      return serverMessage || "The AI on the laptop isn't running. Start Ollama on the laptop.";
    case 504:
      return "The laptop's AI took too long. Try again.";
    default:
      return status >= 500 ? `The laptop hub had a problem (${status}).` : `The laptop hub refused the request (${status}).`;
  }
}

/** Retry-After in seconds (the hub sends seconds; an HTTP date is also allowed by the standard). */
export function retryAfterSeconds(header: string | null, now = Date.now()): number | undefined {
  if (!header) return undefined;
  const n = Number(header);
  if (Number.isFinite(n)) return Math.max(0, Math.round(n));
  const t = Date.parse(header);
  return Number.isFinite(t) ? Math.max(0, Math.round((t - now) / 1000)) : undefined;
}
