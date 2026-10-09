import { networkInterfaces } from "node:os";
import { connection } from "next/server";

/** Local network addresses the phone can use to reach this hub (same Wi-Fi or hotspot). */
export async function GET(req: Request) {
  await connection();
  const port = new URL(req.url).port || "3000";
  const addresses = Object.values(networkInterfaces())
    .flat()
    .filter((a) => a && a.family === "IPv4" && !a.internal)
    .map((a) => `${a!.address}:${port}`);
  return Response.json({ addresses });
}
