import { PublicIntakeError, submitPublicEmergencyIntake, validatePublicEmergencyIntake } from "@/lib/serverPublicEmergencyIntakes";

const maxBodyBytes = 8 * 1024;

async function readBodyWithinLimit(request: Request) {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBodyBytes) {
        await reader.cancel();
        throw new PublicIntakeError("The request form is too large.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(body);
  } catch {
    throw new PublicIntakeError("The request form must contain valid text.", 400);
  }
}

export async function POST(request: Request) {
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > maxBodyBytes) {
    return Response.json({ error: "The request form is too large." }, { status: 413 });
  }

  try {
    const bodyText = await readBodyWithinLimit(request);
    let body: unknown;
    try {
      body = JSON.parse(bodyText);
    } catch {
      return Response.json({ error: "A valid request form is required." }, { status: 400 });
    }

    const input = validatePublicEmergencyIntake(body);
    const result = await submitPublicEmergencyIntake(
      input,
      request.headers.get("idempotency-key") || "",
    );
    return Response.json(
      { reference: result.reference },
      {
        status: result.duplicate ? 200 : 201,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    if (error instanceof PublicIntakeError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json(
      { error: "Your request could not be submitted right now. Please try again later." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
