// GET /api/github/:username[?refresh=1]
// This file only handles HTTP: read input, call the service, format the response.

import { NextResponse, type NextRequest } from "next/server";
import { NO_STORE, errorResponse, toErrorResponse } from "@/lib/api-response";
import { getCard } from "@/lib/profile-service";
import type { ApiSuccess } from "@/lib/types";
import { parseUsername } from "@/lib/validation";

export async function GET(request: NextRequest, context: { params: Promise<{ username: string }> }) {
  const { username: rawUsername } = await context.params;

  const parsed = parseUsername(rawUsername);
  if (!parsed.ok) return errorResponse(400, "INVALID_USERNAME", parsed.message);

  const refresh = request.nextUrl.searchParams.get("refresh") === "1";

  try {
    const data = await getCard(parsed.username, refresh);
    const body: ApiSuccess = { ok: true, data };
    return NextResponse.json(body, { headers: NO_STORE });
  } catch (error) {
    return toErrorResponse(error);
  }
}
