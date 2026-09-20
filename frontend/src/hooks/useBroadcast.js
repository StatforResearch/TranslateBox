import { useState, useRef, useCallback, useEffect } from "react";
import { OperatorBroadcaster, WS_BASE } from "../lib/broadcast";
import { usePersistentState } from "./usePersistentState";

// V1 broadcast: ONE operator captures the translated audio stream and fans it
// out to many listeners through the backend WebSocket hub. Listeners never
// touch OpenAI. This hook owns all event/broadcast state for the operator.
export function useBroadcast({ API, engineRef, targetLang, profile, start, stop, setError, targetText }) {
  const [eventInfo, setEventInfo] = useState(null);
  const [listeners, setListeners] = useState(0);
  const [broadcasting, setBroadcasting] = useState(false);
  const [captionsToListeners, setCaptionsToListeners] = usePersistentState("tbl-listener-captions", false);
  const broadcasterRef = useRef(null);

  const _attach = useCallback(async (evId) => {
    const stream = engineRef.current.audioEl?.srcObject;
    if (!stream) return false;
    const b = new OperatorBroadcaster(`${WS_BASE}/api/ws/${evId}?role=operator`, { onCount: setListeners });
    await b.start(stream);
    broadcasterRef.current = b;
    setBroadcasting(true);
    return true;
  }, [engineRef]);

  const _detach = useCallback(() => {
    if (broadcasterRef.current) { broadcasterRef.current.stop(); broadcasterRef.current = null; }
    setBroadcasting(false);
  }, []);

  const createEvent = useCallback(async (fields = {}) => {
    const res = await fetch(`${API}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fields.name || "Live Interpretation",
        organization: fields.organization || profile.organization || "",
        target_language: targetLang,
        pin: fields.pin || null,
        captions: captionsToListeners,
      }),
    });
    if (!res.ok) throw new Error("Could not create event");
    const info = await res.json();
    setEventInfo(info);
    return info;
  }, [API, targetLang, captionsToListeners, profile.organization]);

  const startEvent = useCallback(async (fields) => {
    setError(null);
    let ev = eventInfo;
    if (!ev) ev = await createEvent(fields || {});
    await start();
    for (let i = 0; i < 25; i++) {
      if (engineRef.current.audioEl?.srcObject) break;
      await new Promise((r) => setTimeout(r, 200));
    }
    try {
      await _attach(ev.id);
    } catch (e) {
      setError("Broadcast could not start: " + e.message);
    }
    return ev;
  }, [eventInfo, createEvent, start, engineRef, setError, _attach]);

  const stopEvent = useCallback(() => {
    _detach();
    setListeners(0);
    stop();
  }, [_detach, stop]);

  const restartBroadcast = useCallback(async () => {
    _detach();
    if (eventInfo) await _attach(eventInfo.id);
  }, [_detach, _attach, eventInfo]);

  useEffect(() => {
    if (broadcasting && captionsToListeners && broadcasterRef.current) {
      broadcasterRef.current.sendCaption(targetText);
    }
  }, [targetText, broadcasting, captionsToListeners]);

  return {
    createEvent, startEvent, stopEvent, restartBroadcast,
    eventInfo, listeners, broadcasting,
    captionsToListeners, setCaptionsToListeners,
  };
}
