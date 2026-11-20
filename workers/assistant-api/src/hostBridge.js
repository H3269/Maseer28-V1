const SDK_URLS = Object.freeze({
  telegram: "https://telegram.org/js/telegram-web-app.js?64",
  bale: "https://tapi.bale.ai/miniapp.js",
});

const SDK_MARKERS = Object.freeze({
  telegram: "telegram-web-app.js",
  bale: "miniapp.js",
});

function readExistingInitData(windowRef) {
  const candidates = [];
  const baleData = windowRef?.Bale?.WebApp?.initData;
  const telegramData = windowRef?.Telegram?.WebApp?.initData;

  if (typeof baleData === "string" && baleData.length > 0) {
    candidates.push({ platform: "bale", initData: baleData });
  }
  if (typeof telegramData === "string" && telegramData.length > 0) {
    candidates.push({ platform: "telegram", initData: telegramData });
  }

  if (candidates.length > 1) return { error: "ambiguous_platform" };
  if (candidates.length === 1) return { value: candidates[0] };

  if (windowRef?.Bale?.WebApp || windowRef?.Telegram?.WebApp) {
    return { error: "missing_init_data" };
  }

  return null;
}

function detectPlatform(windowRef) {
  const search = windowRef?.location?.search || "";
  const params = new URLSearchParams(search);
  if (params.has("tgWebAppPlatform") || /telegram/i.test(windowRef?.navigator?.userAgent || "")) {
    return "telegram";
  }
  if (/bale/i.test(windowRef?.navigator?.userAgent || "")) {
    return "bale";
  }
  return null;
}

function sdkAlreadyPresent(documentRef, platform) {
  const marker = SDK_MARKERS[platform];
  return [...(documentRef?.scripts || [])].some((script) =>
    String(script.src || "").includes(marker)
  );
}

async function loadPlatformSdk({ windowRef, documentRef, platform, timeoutMs }) {
  if (sdkAlreadyPresent(documentRef, platform)) {
    return { ok: false, reason: "sdk_loading_state_unknown" };
  }

  if (!documentRef?.head || typeof documentRef.createElement !== "function") {
    return { ok: false, reason: "sdk_unavailable" };
  }

  return new Promise((resolve) => {
    let settled = false;
    const script = documentRef.createElement("script");
    const timeout = setTimeout(() => finish({ ok: false, reason: "sdk_timeout" }), timeoutMs);

    function finish(result) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      script.onload = null;
      script.onerror = null;
      resolve(result);
    }

    script.src = SDK_URLS[platform];
    script.async = true;
    script.onload = () => finish({ ok: true });
    script.onerror = () => finish({ ok: false, reason: "sdk_load_failed" });
    documentRef.head.appendChild(script);
  });
}

/**
 * Reads signed Mini App initData only after an explicit caller invokes this
 * function. It never sends, stores, logs, or parses the data.
 *
 * User-Agent is used only to select which official SDK to load. It is NOT
 * authentication; the Worker must verify the returned initData HMAC.
 */
export async function loadMiniAppInitData({
  windowRef = globalThis.window,
  documentRef = globalThis.document,
  timeoutMs = 4000,
} = {}) {
  if (!windowRef || !documentRef) return { ok: false, reason: "browser_unavailable" };

  const existing = readExistingInitData(windowRef);
  if (existing?.error) return { ok: false, reason: existing.error };
  if (existing?.value) return { ok: true, ...existing.value };

  const platform = detectPlatform(windowRef);
  if (!platform) return { ok: false, reason: "unsupported_platform" };

  const loaded = await loadPlatformSdk({ windowRef, documentRef, platform, timeoutMs });
  if (!loaded.ok) return loaded;

  const result = readExistingInitData(windowRef);
  if (result?.error) return { ok: false, reason: result.error };
  if (result?.value?.platform === platform) return { ok: true, ...result.value };

  return { ok: false, reason: "missing_init_data" };
}
