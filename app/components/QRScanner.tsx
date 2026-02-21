"use client";

import React, { useEffect, useRef, useState } from "react";

type ScanItem = {
  text: string;
  format?: string;
  timestamp: string;
};

type XIdItem = {
  id: string;
  url: string;
  timestamp: string;
};
export default function QRScanner() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const html5Ref = useRef<any>(null);
  const [scans, setScans] = useState<ScanItem[]>([]);
  const [xIds, setXIds] = useState<XIdItem[]>([]);
  const [running, setRunning] = useState(false);
  const [devices, setDevices] = useState<Array<{ id: string; label?: string }>>([]);
  const [popup, setPopup] = useState<string | null>(null);
  const popupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      // cleanup on unmount
      if (html5Ref.current) {
        html5Ref.current
          .stop()
          .catch(() => {})
          .then(() => html5Ref.current.clear && html5Ref.current.clear());
      }
      if (popupTimerRef.current) {
        clearTimeout(popupTimerRef.current);
      }
    };
  }, []);

  const startScanner = async () => {
    if (!containerRef.current) return;

    try {
      const mod = await import("html5-qrcode");
      const Html5Qrcode = mod.Html5Qrcode || mod.default?.Html5Qrcode || mod.default;
      const elementId = `qr-reader-${Date.now()}`;
      containerRef.current.id = elementId;

      const html5Qr = new Html5Qrcode(elementId);
      html5Ref.current = html5Qr;

      const config = { fps: 10, qrbox: { width: 300, height: 300 } };
      const showPopup = (text: string) => {
        setPopup(text);
        if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
        popupTimerRef.current = setTimeout(() => setPopup(null), 3000);
      };

      const onSuccess = (decodedText: string, decodedResult: any) => {
        const rawFormat = decodedResult?.result?.format;
        const formatStr = typeof rawFormat === "string"
          ? rawFormat
          : rawFormat?.formatName ?? rawFormat?.format ?? (rawFormat ? JSON.stringify(rawFormat) : undefined);
        setScans((prev) => [
          { text: decodedText, format: formatStr || "QR_CODE", timestamp: new Date().toISOString() },
          ...prev,
        ]);
        try {
          // If the scanned text is an x.com URL, extract ID and manage separate table
          const extractXId = (urlText: string) => {
            try {
              // Accept URLs that start with https://x.com/
              if (!urlText.startsWith("https://x.com/")) return null;
              const u = new URL(urlText);
              let p = u.pathname.replace(/\/+$/g, "");
              if (!p) return null;
              const seg = p.split("/").pop();
              return seg || null;
            } catch (_) {
              return null;
            }
          };

          const xId = extractXId(decodedText);
          if (xId) {
            setXIds((prev) => {
              const exists = prev.some((it) => it.id === xId);
              if (exists) {
                showPopup("読み取り済みです");
                return prev;
              }
              showPopup(`ID: ${xId}`);
              return [{ id: xId, url: decodedText, timestamp: new Date().toISOString() }, ...prev];
            });
          } else {
            showPopup(decodedText);
          }
        } catch (_) {}
      };

      const onError = (errorMessage: string) => {
        // can be used for debug
      };

      const tryStart = async (cameraIdOrConfig: any) => {
        try {
          // html5-qrcode requires a cameraId or a valid camera config (string or object)
          await html5Qr.start(cameraIdOrConfig, config, onSuccess, onError);
          return true;
        } catch (err: any) {
          console.warn("html5-qrcode start failed for", cameraIdOrConfig, err?.name || err?.message || err);
          // Attempt safe stop/clear and allow a short pause for internal state transitions
          try {
            // stop may throw if not started or mid-transition
            // eslint-disable-next-line no-await-in-loop
            await html5Qr.stop();
          } catch (_) {}
          try {
            html5Qr.clear && html5Qr.clear();
          } catch (_) {}
          // give the browser/library a moment to settle
          // eslint-disable-next-line no-await-in-loop
          await new Promise((r) => setTimeout(r, 300));
          return false;
        }
      };

      // First try enumerating available cameras (deviceId) — works well on desktops
      let started = false;
      try {
        const getCamerasFn = (Html5Qrcode as any)?.getCameras || (mod && (mod as any).getCameras);
        if (getCamerasFn) {
          const cams = await getCamerasFn();
          if (cams && cams.length) {
            setDevices(cams);
            for (const cam of cams) {
              // eslint-disable-next-line no-await-in-loop
              started = await tryStart(cam.id);
              if (started) break;
            }
          }
        }
      } catch (err) {
        console.warn("getCameras enumeration failed:", err);
      }

      // If deviceId attempts failed, fall back to facingMode options
      if (!started) {
        const candidates = [
          // simple string accepted by html5-qrcode
          "environment",
          // object with exact key is accepted
          { facingMode: { exact: "environment" } },
        ];
        for (const c of candidates) {
          // eslint-disable-next-line no-await-in-loop
          started = await tryStart(c);
          if (started) break;
        }
      }


      if (!started) {
        throw new Error("カメラの開始に失敗しました（制約/デバイスが見つかりません）。");
      }

      setRunning(true);
    } catch (e) {
      console.error("Failed to start QR scanner:", e);
      const msg = e instanceof Error ? e.message : String(e);
      alert(`カメラの開始に失敗しました: ${msg}`);
    }
  };

  const stopScanner = async () => {
    if (!html5Ref.current) return;
    try {
      await html5Ref.current.stop();
      html5Ref.current.clear && html5Ref.current.clear();
    } catch (e) {
      // ignore
    }
    html5Ref.current = null;
    setRunning(false);
  };

  const clearScans = () => setScans([]);

  return (
    <div className="w-full">
      {/* Popup for recent scan */}
      {popup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="w-full h-full flex items-center justify-center p-6">
            <div className="max-w-full text-center text-white text-2xl md:text-4xl lg:text-6xl font-medium break-words">
              {popup}
            </div>
          </div>
        </div>
      )}
      <div className="mb-4 flex gap-2">
        <button
          className="rounded bg-blue-600 px-4 py-2 text-white"
          onClick={startScanner}
          disabled={running}
        >
          カメラ開始
        </button>
        <button
          className="rounded bg-gray-600 px-4 py-2 text-white"
          onClick={stopScanner}
          disabled={!running}
        >
          停止
        </button>
        <button className="rounded bg-red-600 px-4 py-2 text-white" onClick={clearScans}>
          履歴クリア
        </button>
        <button
          className="rounded bg-yellow-600 px-4 py-2 text-white"
          onClick={() => setXIds([])}
          disabled={xIds.length === 0}
        >
          IDリストクリア
        </button>
      </div>

      <div ref={containerRef} className="w-full rounded border border-gray-200 bg-black/5" style={{ minHeight: 320 }} />

      <h2 className="mt-6 mb-2 text-lg font-medium">読み取り結果</h2>
      <div className="overflow-x-auto">
        <table className="w-full table-auto border-collapse text-sm">
          <thead>
            <tr className="text-left">
              <th className="border-b p-2">時刻</th>
              <th className="border-b p-2">内容</th>
              <th className="border-b p-2">フォーマット</th>
            </tr>
          </thead>
          <tbody>
            {scans.length === 0 ? (
              <tr>
                <td className="p-2" colSpan={3}>まだ読み取られていません</td>
              </tr>
            ) : (
              scans.map((s, i) => (
                <tr key={`${s.timestamp}-${i}`} className="odd:bg-white even:bg-gray-50">
                  <td className="p-2 align-top">{new Date(s.timestamp).toLocaleString()}</td>
                  <td className="p-2 align-top break-words max-w-lg">{s.text}</td>
                  <td className="p-2 align-top">{s.format}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <h2 className="mt-6 mb-2 text-lg font-medium">X.com のID一覧</h2>
      <div className="overflow-x-auto">
        <table className="w-full table-auto border-collapse text-sm">
          <thead>
            <tr className="text-left">
              <th className="border-b p-2">ID</th>
              <th className="border-b p-2">元URL</th>
              <th className="border-b p-2">登録時刻</th>
            </tr>
          </thead>
          <tbody>
            {xIds.length === 0 ? (
              <tr>
                <td className="p-2" colSpan={3}>まだIDが登録されていません</td>
              </tr>
            ) : (
              xIds.map((it, i) => (
                <tr key={`${it.id}-${i}`} className="odd:bg-white even:bg-gray-50">
                  <td className="p-2 align-top">{it.id}</td>
                  <td className="p-2 align-top break-words max-w-lg">{it.url}</td>
                  <td className="p-2 align-top">{new Date(it.timestamp).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
