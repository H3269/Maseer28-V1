import test from "node:test";
import assert from "node:assert/strict";
import { loadMiniAppInitData } from "../workers/assistant-api/src/hostBridge.js";

function makeWindow({ userAgent = "", search = "", bale, telegram } = {}) {
  return {
    navigator: { userAgent },
    location: { search },
    ...(bale ? { Bale: { WebApp: bale } } : {}),
    ...(telegram ? { Telegram: { WebApp: telegram } } : {}),
  };
}

function makeDocument({ onLoad } = {}) {
  const scripts = [];
  return {
    scripts,
    head: {
      appendChild(script) {
        scripts.push(script);
        if (onLoad) onLoad(script);
      },
    },
    createElement(tag) {
      assert.equal(tag, "script");
      return { src: "", async: false, onload: null, onerror: null };
    },
  };
}

test("reads existing Bale initData without loading another SDK", async () => {
  const windowRef = makeWindow({ bale: { initData: "signed-bale-data" } });
  const documentRef = makeDocument();
  const result = await loadMiniAppInitData({ windowRef, documentRef });

  assert.deepEqual(result, { ok: true, platform: "bale", initData: "signed-bale-data" });
  assert.equal(documentRef.scripts.length, 0);
});

test("reads existing Telegram initData without loading another SDK", async () => {
  const windowRef = makeWindow({ telegram: { initData: "signed-telegram-data" } });
  const documentRef = makeDocument();
  const result = await loadMiniAppInitData({ windowRef, documentRef });

  assert.deepEqual(result, { ok: true, platform: "telegram", initData: "signed-telegram-data" });
  assert.equal(documentRef.scripts.length, 0);
});

test("loads only the official Bale SDK lazily when the Bale host is detected", async () => {
  const windowRef = makeWindow({ userAgent: "Bale Android WebView" });
  const documentRef = makeDocument({
    onLoad(script) {
      windowRef.Bale = { WebApp: { initData: "signed-bale-data" } };
      script.onload();
    },
  });
  const result = await loadMiniAppInitData({ windowRef, documentRef });

  assert.deepEqual(result, { ok: true, platform: "bale", initData: "signed-bale-data" });
  assert.equal(documentRef.scripts.length, 1);
  assert.equal(documentRef.scripts[0].src, "https://tapi.bale.ai/miniapp.js");
});

test("loads only the official Telegram SDK lazily when Telegram launch data is present", async () => {
  const windowRef = makeWindow({ search: "?tgWebAppPlatform=android" });
  const documentRef = makeDocument({
    onLoad(script) {
      windowRef.Telegram = { WebApp: { initData: "signed-telegram-data" } };
      script.onload();
    },
  });
  const result = await loadMiniAppInitData({ windowRef, documentRef });

  assert.deepEqual(result, { ok: true, platform: "telegram", initData: "signed-telegram-data" });
  assert.equal(documentRef.scripts.length, 1);
  assert.equal(documentRef.scripts[0].src, "https://telegram.org/js/telegram-web-app.js?64");
});

test("does not treat an ordinary browser as an authenticated Mini App", async () => {
  const result = await loadMiniAppInitData({
    windowRef: makeWindow({ userAgent: "Mozilla/5.0" }),
    documentRef: makeDocument(),
  });

  assert.deepEqual(result, { ok: false, reason: "unsupported_platform" });
});

test("fails closed when a platform SDK exists but initData is empty", async () => {
  const result = await loadMiniAppInitData({
    windowRef: makeWindow({ bale: { initData: "" } }),
    documentRef: makeDocument(),
  });

  assert.deepEqual(result, { ok: false, reason: "missing_init_data" });
});

test("rejects ambiguous platform globals", async () => {
  const result = await loadMiniAppInitData({
    windowRef: makeWindow({
      bale: { initData: "bale" },
      telegram: { initData: "telegram" },
    }),
    documentRef: makeDocument(),
  });

  assert.deepEqual(result, { ok: false, reason: "ambiguous_platform" });
});

test("does not silently reuse an SDK tag whose load state is unknown", async () => {
  const windowRef = makeWindow({ userAgent: "Bale Android WebView" });
  const documentRef = makeDocument();
  documentRef.scripts.push({ src: "https://tapi.bale.ai/miniapp.js" });

  const result = await loadMiniAppInitData({ windowRef, documentRef });
  assert.deepEqual(result, { ok: false, reason: "sdk_loading_state_unknown" });
});
