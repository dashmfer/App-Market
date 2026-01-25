import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#22c55e',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Title */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            color: 'white',
            marginBottom: 20,
          }}
        >
          App Market
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 32,
            color: 'rgba(255, 255, 255, 0.9)',
          }}
        >
          Buy & Sell Apps, MVPs, and Prototypes
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
