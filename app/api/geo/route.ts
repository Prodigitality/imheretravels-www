/**
 * The visitor's country (ISO alpha-2) from Vercel's IP lookup, so the phone
 * fields can preselect it. Nothing is stored; null when Vercel doesn't know
 * (e.g. local dev).
 */
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const raw = request.headers.get("x-vercel-ip-country") ?? "";
  const country = /^[A-Z]{2}$/.test(raw) ? raw : null;
  return Response.json({ country }, { headers: { "Cache-Control": "private, no-store" } });
}
