import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: 180,
        height: 180,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0f2847 0%, #1d4ed8 100%)',
        borderRadius: 38,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          gap: 10,
          height: 110,
          paddingBottom: 4,
        }}
      >
        <div
          style={{
            width: 16,
            height: 50,
            background: 'white',
            borderRadius: 8,
          }}
        />
        <div
          style={{
            width: 16,
            height: 72,
            background: 'white',
            borderRadius: 8,
          }}
        />
        <div
          style={{
            width: 16,
            height: 95,
            background: '#60a5fa',
            borderRadius: 8,
          }}
        />
        <div
          style={{
            width: 16,
            height: 72,
            background: 'white',
            borderRadius: 8,
          }}
        />
        <div
          style={{
            width: 16,
            height: 50,
            background: 'white',
            borderRadius: 8,
          }}
        />
      </div>
    </div>,
    { ...size },
  );
}
