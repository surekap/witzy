const baseAudio =
  "UklGRnQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVAAAAAAAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA";

export const AUDIO_TONE_DATA_URI = `data:audio/wav;base64,${baseAudio}`;

export function createImageDataUri(title: string, subtitle: string, tone: string) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="800" height="480" viewBox="0 0 800 480" role="img" aria-label="${title}">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="${tone}" />
          <stop offset="100%" stop-color="#0f172a" />
        </linearGradient>
      </defs>
      <rect width="800" height="480" rx="36" fill="url(#bg)" />
      <circle cx="120" cy="120" r="72" fill="rgba(255,255,255,0.18)" />
      <circle cx="690" cy="380" r="96" fill="rgba(255,255,255,0.12)" />
      <text x="64" y="184" fill="#f8fafc" font-size="54" font-family="Trebuchet MS, Verdana, sans-serif" font-weight="700">${title}</text>
      <text x="64" y="252" fill="#e2e8f0" font-size="28" font-family="Trebuchet MS, Verdana, sans-serif">${subtitle}</text>
      <text x="64" y="406" fill="#fef3c7" font-size="24" font-family="Trebuchet MS, Verdana, sans-serif">Demo clue card</text>
    </svg>
  `.trim();

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
