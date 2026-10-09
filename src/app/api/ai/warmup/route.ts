import { withGuard } from "@/lib/server/guard";
import { getStatus, MODELS, warm } from "@/lib/server/ollama";
import { errorResponse } from "@/lib/server/respond";

/** Loads both models into GPU memory so the first real request is fast. */
async function handle(): Promise<Response> {
  try {
    // One at a time so the two models don't compete for GPU memory while loading.
    await warm(MODELS.text);
    await warm(MODELS.vision);
    return Response.json(await getStatus());
  } catch (e) {
    return errorResponse(e);
  }
}

/** No body and no key needed (it only loads the models), but rate limited. */
export const POST = withGuard(handle, { auth: false, json: false });
