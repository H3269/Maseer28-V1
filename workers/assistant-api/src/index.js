const SERVICE = "maseer28-assistant-api";
const API_VERSION = "v1";

function allowedOrigins(env) {
  return new Set(
    String(env.ALLOWED_ORIGINS || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

function securityHeaders() {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  };
}

function jsonResponse(payload, status, origin, origins) {
  const headers = new Headers(securityHeaders());
  if (origin && origins.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }
  return new Response(JSON.stringify(payload), { status, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const origins = allowedOrigins(env);
    const originAllowed = !origin || origins.has(origin);

    if (request.method === "OPTIONS") {
      if (!origin || !origins.has(origin)) {
        return jsonResponse({ error: "origin_not_allowed" }, 403, null, origins);
      }

      const headers = new Headers(securityHeaders());
      headers.set("Access-Control-Allow-Origin", origin);
      headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      headers.set("Access-Control-Allow-Headers", "Content-Type");
      headers.set("Access-Control-Max-Age", "600");
      headers.set("Vary", "Origin");
      return new Response(null, { status: 204, headers });
    }

    if (!originAllowed) {
      return jsonResponse({ error: "origin_not_allowed" }, 403, null, origins);
    }

    if (url.pathname === "/health" && request.method === "GET") {
      return jsonResponse(
        {
          status: "ok",
          service: SERVICE,
          apiVersion: API_VERSION,
          assistantEnabled: false,
          providerConfigured: false,
        },
        200,
        origin,
        origins,
      );
    }

    if (url.pathname === "/v1/assistant/turn" && request.method === "POST") {
      // Intentionally do not read or persist the request body until consent,
      // privacy, safety, and provider requirements are implemented and tested.
      return jsonResponse(
        {
          error: "assistant_not_configured",
          message: "پردازش ابری دستیار هنوز فعال نشده است.",
          retryable: false,
        },
        503,
        origin,
        origins,
      );
    }

    if (url.pathname === "/v1/assistant/turn") {
      return jsonResponse(
        { error: "method_not_allowed" },
        405,
        origin,
        origins,
      );
    }

    return jsonResponse({ error: "not_found" }, 404, origin, origins);
  },
};
