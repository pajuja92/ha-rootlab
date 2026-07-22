// Dyktowanie: najpierw pipeline STT z Home Assistant (Twoja integracja STT, np. Google AI),
// fallback: Web Speech API przeglądarki. Przycisk 🎤 doklejany do textarea.
import { t } from "./i18n.js";

let activeStop = null;

export function attachMic(app, textarea) {
  if (!textarea || textarea.parentElement.querySelector(".mic-btn")) return;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "icon-btn mic-btn";
  btn.title = t("mic.start");
  btn.innerHTML = `<ha-icon icon="mdi:microphone-outline"></ha-icon>`;
  textarea.parentElement.style.position = "relative";
  textarea.parentElement.appendChild(btn);

  btn.addEventListener("click", async () => {
    if (activeStop) {
      activeStop();
      return;
    }
    btn.classList.add("recording");
    btn.title = t("mic.stop");
    const done = (text) => {
      btn.classList.remove("recording");
      btn.title = t("mic.start");
      activeStop = null;
      if (text) textarea.value = (textarea.value ? textarea.value + " " : "") + text;
    };
    try {
      await haPipelineStt(app, done, (stop) => (activeStop = stop));
    } catch (e) {
      try {
        webSpeech(app, done, (stop) => (activeStop = stop));
      } catch (e2) {
        done(null);
        alert(t("mic.unsupported"));
      }
    }
  });
}

/* STT przez assist pipeline HA — audio 16 kHz PCM16 przez websocket. */
async function haPipelineStt(app, done, registerStop) {
  const conn = app.hass.connection;
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
  });
  const ctx = new AudioContext({ sampleRate: 16000 });
  const source = ctx.createMediaStreamSource(stream);
  const proc = ctx.createScriptProcessor(4096, 1, 1);
  let handlerId = null;
  let finished = false;

  const cleanup = () => {
    proc.disconnect();
    source.disconnect();
    stream.getTracks().forEach((tr) => tr.stop());
    ctx.close();
  };
  const finish = (text) => {
    if (finished) return;
    finished = true;
    cleanup();
    unsub?.();
    done(text);
  };

  let unsub;
  unsub = await conn.subscribeMessage(
    (ev) => {
      if (ev.type === "run-start") {
        handlerId = ev.data?.runner_data?.stt_binary_handler_id;
      } else if (ev.type === "stt-end") {
        finish(ev.data?.stt_output?.text || "");
      } else if (ev.type === "error" || ev.type === "run-end") {
        finish(null);
      }
    },
    {
      type: "assist_pipeline/run",
      start_stage: "stt",
      end_stage: "stt",
      input: { sample_rate: 16000 },
    }
  );

  proc.onaudioprocess = (ev) => {
    if (handlerId == null || finished) return;
    const f32 = ev.inputBuffer.getChannelData(0);
    const i16 = new Int16Array(f32.length);
    for (let i = 0; i < f32.length; i++) {
      i16[i] = Math.max(-1, Math.min(1, f32[i])) * 0x7fff;
    }
    const out = new Uint8Array(i16.buffer.byteLength + 1);
    out[0] = handlerId;
    out.set(new Uint8Array(i16.buffer), 1);
    conn.socket.send(out);
  };
  source.connect(proc);
  proc.connect(ctx.destination);

  registerStop(() => {
    // pusty frame z handlerId = koniec audio → pipeline zwraca stt-end
    if (handlerId != null) conn.socket.send(new Uint8Array([handlerId]));
    setTimeout(() => finish(null), 4000); // awaryjnie, gdyby stt-end nie przyszedł
  });
}

/* Fallback: Web Speech API. */
function webSpeech(app, done, registerStop) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) throw new Error("unsupported");
  const rec = new SR();
  rec.lang = app.hass.language || "pl-PL";
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  let text = "";
  rec.onresult = (ev) => {
    text = Array.from(ev.results).map((r) => r[0].transcript).join(" ");
  };
  rec.onend = () => done(text || null);
  rec.onerror = () => done(null);
  rec.start();
  registerStop(() => rec.stop());
}
