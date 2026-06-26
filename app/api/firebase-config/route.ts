import { NextResponse } from 'next/server';

export async function GET() {
  const config = {
    apiKey:            process.env.FIREBASE_API_KEY,
    authDomain:        process.env.FIREBASE_AUTH_DOMAIN,
    projectId:         process.env.FIREBASE_PROJECT_ID,
    storageBucket:     process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId:             process.env.FIREBASE_APP_ID,
  };

  const emFalta = Object.entries(config).filter(([, v]) => !v).map(([k]) => k);
  if (emFalta.length) {
    return NextResponse.json({ error: `Variáveis em falta: ${emFalta.join(', ')}` }, { status: 500 });
  }

  return NextResponse.json(config, {
    headers: { 'Cache-Control': 'public, max-age=3600' },
  });
}
