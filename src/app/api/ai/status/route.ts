import { connection } from "next/server";
import { accessFor } from "@/lib/server/guard";
import { getStatus } from "@/lib/server/ollama";

/** Public and read-only. Also says whether AI requests need the team access key, and if the one sent is right. */
export async function GET(req: Request) {
  await connection();
  const access = accessFor(req);
  return Response.json({ ...(await getStatus()), auth: access === "open" ? "open" : "required", authorized: access === "open" || access === "ok" });
}
