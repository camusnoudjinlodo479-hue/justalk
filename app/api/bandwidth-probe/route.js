// app/api/bandwidth-probe/route.js
// Renvoie un payload de taille fixe (~256KB) pour estimer le débit réel côté
// client quand l'API navigator.connection n'est pas disponible (Safari/iOS).
import { NextResponse } from "next/server";

const PAYLOAD = new Uint8Array(256 * 1024); // 256 KB de zéros

export async function GET() {
  return new NextResponse(PAYLOAD, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Cache-Control": "no-store",
    },
  });
}
