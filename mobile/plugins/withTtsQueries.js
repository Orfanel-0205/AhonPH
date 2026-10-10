// Android 11+ hides services from apps unless they declare them. Without this <queries> entry the app
// can't bind to the text-to-speech engine ("speak failed: not bound to TTS engine") and stays silent.
const { withAndroidManifest } = require("expo/config-plugins");

module.exports = function withTtsQueries(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest.queries = manifest.queries ?? [];
    const has = manifest.queries.some((q) => (q.intent ?? []).some((i) => (i.action ?? []).some((a) => a.$["android:name"] === "android.intent.action.TTS_SERVICE")));
    if (!has) manifest.queries.push({ intent: [{ action: [{ $: { "android:name": "android.intent.action.TTS_SERVICE" } }] }] });
    return cfg;
  });
};
