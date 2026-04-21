import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

const LANDMARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="108" height="108" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 20 7 4 7"/><line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/></svg>`;

export default function AppleIcon() {
  const src = `data:image/svg+xml;utf8,${encodeURIComponent(LANDMARK_SVG)}`;
  return new ImageResponse(
    <div
      style={{
        width: 180,
        height: 180,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#1d4ed8',
        borderRadius: 38,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} width={108} height={108} alt="" />
    </div>,
    { ...size },
  );
}
