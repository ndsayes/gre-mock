// Talks to Claude from the phone. The API key is typed by the owner into Settings, kept in this
// browser's storage, and sent only to Anthropic. Exposes window.Tutor for app.js.
import Anthropic from "./vendor/anthropic-sdk.js";

const MODEL = "claude-opus-5-5";
// If the model declines a request, let Anthropic re-run it on its default fallback model in the same call.
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

function client(key) {
  return new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true, timeout: 120000, maxRetries: 1 });
}

// Streams one tutor reply. `onText` receives the whole answer so far. Resolves with the final message.
async function reply({ key, system, messages, effort, onText, signal }) {
  const body = {
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: { effort },
    system,
    messages,
  };
  const run = (stream) => {
    if (signal) {
      if (signal.aborted) stream.abort();
      else signal.addEventListener("abort", () => stream.abort(), { once: true });
    }
    stream.on("text", (delta, snapshot) => onText(snapshot));
    return stream.finalMessage();
  };
  try {
    return await run(client(key).beta.messages.stream({ ...body, betas: [FALLBACK_BETA], fallbacks: "default" }));
  } catch (e) {
    // The fallback option is a beta. If the API ever rejects it, answer without it rather than not at all.
    if (e instanceof Anthropic.BadRequestError && /fallback|beta/i.test(String(e.message))) {
      return run(client(key).messages.stream(body));
    }
    throw e;
  }
}

// Costs nothing: it only asks whether this key may use the tutor's model.
async function testKey(key) {
  await client(key).models.retrieve(MODEL);
  return true;
}

// Turns an error into something the student can act on.
function explain(e) {
  if (e instanceof Anthropic.APIUserAbortError) return { cancelled: true, text: "Stopped." };
  if (e instanceof Anthropic.AuthenticationError) return { text: "Your API key was not accepted. Check it in Settings." };
  if (e instanceof Anthropic.PermissionDeniedError) return { text: "Your API key is not allowed to use this model. Check the key in the Anthropic console." };
  if (e instanceof Anthropic.RateLimitError) return { text: "Too many requests right now. Wait a minute and try again." };
  if (e instanceof Anthropic.BadRequestError) {
    const m = String(e.message || "");
    if (/credit|billing/i.test(m)) return { text: "Your API credit has run out. Top it up in the Anthropic console." };
    return { text: "Claude could not accept that request. Try again, or try a smaller photo." };
  }
  if (e instanceof Anthropic.APIConnectionError) return { text: "No connection to Claude. Check your signal and try again." };
  if (e instanceof Anthropic.APIError) return { text: "Claude is busy right now. Try again in a moment." };
  return { text: "That did not go through. Try again." };
}

// Shrinks a phone photo to at most 1568 px on its long side and returns it as base64 JPEG.
function photo(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1568 / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      resolve({ media_type: "image/jpeg", data: dataUrl.slice(dataUrl.indexOf(",") + 1) });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("unreadable photo")); };
    img.src = url;
  });
}

window.Tutor = { reply, testKey, explain, photo, model: MODEL };
window.dispatchEvent(new Event("tutor-ready"));
