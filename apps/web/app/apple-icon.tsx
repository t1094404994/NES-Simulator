import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#1a120e',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: 148,
            height: 76,
            background: '#2c241e',
            borderRadius: 38,
            border: '8px solid #4a3f36',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 22px',
          }}
        >
          <div style={{ display: 'flex', width: 34, height: 34, position: 'relative' }}>
            <div
              style={{
                position: 'absolute',
                left: 11,
                top: 0,
                width: 12,
                height: 34,
                background: '#f3eadf',
                borderRadius: 2,
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 11,
                width: 34,
                height: 12,
                background: '#f3eadf',
                borderRadius: 2,
              }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                background: '#c2410c',
                marginTop: 14,
                marginRight: 8,
              }}
            />
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                background: '#f3eadf',
                marginBottom: 14,
              }}
            />
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
