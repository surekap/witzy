"use client";

import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";

// Rendered only after the room has loaded in the browser, so the join link can use the origin the host is actually on.
// `compact` is the small corner version that stays up during play for late joiners.
export function RoomInvite({ roomCode, compact = false }: { roomCode: string; compact?: boolean }) {
  const [message, setMessage] = useState("");
  const joinUrl = `${window.location.origin}/join?room=${roomCode}`;
  return (
    <section className={compact ? "flex flex-wrap items-center gap-4" : "flex flex-wrap items-center justify-center gap-8"} aria-label="Invite players">
      <div className="rounded-xl bg-white p-2">
        <QRCodeSVG className={compact ? "size-[min(22vmin,112px)]" : "size-[min(42vmin,360px)]"} value={joinUrl} size={256} level="M" marginSize={compact ? 2 : 4} title={`Join Witzy room ${roomCode}`} />
      </div>
      <div className="space-y-2">
        <p className="field-label">{compact ? "Late joiners scan in" : "Scan to join"}</p>
        <p className={compact ? "text-2xl font-extrabold tracking-[0.08em]" : "text-[clamp(2.5rem,9vmin,5.5rem)] font-extrabold leading-none tracking-[0.12em]"}>{roomCode}</p>
        {compact ? null : (
          <>
            <a className="block break-all underline" href={joinUrl}>{joinUrl}</a>
            <button className="btn btn-secondary btn-sm" type="button" onClick={async () => {
              try { await navigator.clipboard.writeText(joinUrl); setMessage("Link copied."); }
              catch { setMessage("Copy the link shown above."); }
            }}>Copy join link</button>
            <p role="status">{message}</p>
          </>
        )}
      </div>
    </section>
  );
}
