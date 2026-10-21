"use client";

import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";

export function RoomInvite({ joinUrl, roomCode }: { joinUrl: string; roomCode: string }) {
  const [message, setMessage] = useState("");
  return (
    <section className="flex flex-wrap items-center gap-5" aria-label="Invite players">
      <div className="rounded-xl bg-white p-3">
        <QRCodeSVG value={joinUrl} size={176} level="M" marginSize={4} title={`Join Witzy room ${roomCode}`} />
      </div>
      <div className="space-y-2">
        <p className="field-label">Scan to join</p>
        <p>Scan with your phone camera, then choose your name and age.</p>
        <p>Room code: <strong>{roomCode}</strong></p>
        <a className="break-all underline" href={joinUrl}>{joinUrl}</a>
        <div><button className="btn btn-secondary btn-sm" type="button" onClick={async () => {
          try { await navigator.clipboard.writeText(joinUrl); setMessage("Link copied."); }
          catch { setMessage("Copy the link shown above."); }
        }}>Copy join link</button></div>
        <p role="status">{message}</p>
      </div>
    </section>
  );
}
