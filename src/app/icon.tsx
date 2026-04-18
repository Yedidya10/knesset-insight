import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: 32,
        height: 32,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0f2847 0%, #1d4ed8 100%)',
        borderRadius: 7,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          gap: 2,
          height: 20,
          paddingBottom: 1,
        }}
      >
        <div
          style={{
            width: 3,
            height: 9,
            background: 'white',
            borderRadius: 1.5,
          }}
        />
        <div
          style={{
            width: 3,
            height: 13,
            background: 'white',
            borderRadius: 1.5,
          }}
        />
        <div
          style={{
            width: 3,
            height: 17,
            background: '#60a5fa',
            borderRadius: 1.5,
          }}
        />
        <div
          style={{
            width: 3,
            height: 13,
            background: 'white',
            borderRadius: 1.5,
          }}
        />
        <div
          style={{
            width: 3,
            height: 9,
            background: 'white',
            borderRadius: 1.5,
          }}
        />
      </div>
    </div>,
    { ...size },
  );
}
