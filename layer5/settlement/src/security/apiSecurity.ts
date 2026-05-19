import type { IncomingMessage, ServerResponse } from "node:http";
import { createHash, timingSafeEqual } from "node:crypto";

const WINDOW_MS = 60_000;
const READ_LIMIT = Number(process.env.SETTLEMENT_RATE_LIMIT_READ ?? "300");
const WRITE_LIMIT = Number(process.env.SETTLEMENT_RATE_LIMIT_WRITE ?? "60");

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function clientIp(req: IncomingMessage): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) return fwd.split(",")[0]!.trim();
  return req.socket.remoteAddress ?? "unknown";
}

function checkRateLimit(ip: string, limit: number): boolean {
  const now = Date.now();
  let b = buckets.get(ip);
  if (!b || now >= b.resetAt) {
    b = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(ip, b);
  }
  b.count += 1;
  return b.count <= limit;
}

function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

function corsOrigins(): string[] {
  const raw = process.env.SETTLEMENT_CORS_ORIGINS?.trim();
  if (raw) return raw.split(",").map((s) => s.trim()).filter(Boolean);
  return [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://localhost:5173",
    "https://127.0.0.1:5173",
  ];
}

/** Browser preflight + cross-origin dashboard (dev). Returns true if request is fully handled. */
export function applyCors(req: IncomingMessage, res: ServerResponse): boolean {
  const origin = req.headers.origin;
  const allowed = corsOrigins();
  if (origin && allowed.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, X-Settlement-Api-Key, Authorization",
  );

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return true;
  }
  return false;
}

export function applySecurityHeaders(res: ServerResponse): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Content-Security-Policy", "default-src 'none'");
}

export function isPublicReadAllowed(): boolean {
  return process.env.SETTLEMENT_API_PUBLIC_READ === "true";
}

export function isApiKeyRequired(): boolean {
  return Boolean(process.env.SETTLEMENT_API_KEY?.trim());
}

export function assertApiKey(req: IncomingMessage, res: ServerResponse): boolean {
  const expected = process.env.SETTLEMENT_API_KEY?.trim();
  if (!expected) return true;

  const provided =
    req.headers["x-settlement-api-key"]?.toString() ||
    req.headers.authorization?.replace(/^Bearer\s+/i, "") ||
    "";

  if (!provided || !safeEqual(provided, expected)) {
    res.writeHead(401, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "unauthorized" }));
    return false;
  }
  return true;
}

export function assertRateLimit(
  req: IncomingMessage,
  res: ServerResponse,
  writeRoute: boolean,
): boolean {
  const ip = clientIp(req);
  const limit = writeRoute ? WRITE_LIMIT : READ_LIMIT;
  if (!checkRateLimit(ip, limit)) {
    res.writeHead(429, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "rate_limit_exceeded" }));
    return false;
  }
  return true;
}
