import { connection } from "next/server";
import { getStatus } from "@/lib/server/ollama";

export async function GET() {
  await connection();
  return Response.json(await getStatus());
}
