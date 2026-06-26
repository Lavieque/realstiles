import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST() {
  const cloudName  = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey     = process.env.CLOUDINARY_API_KEY;
  const apiSecret  = process.env.CLOUDINARY_API_SECRET;
  const folder     = process.env.CLOUDINARY_FOLDER || 'realstiles';

  if (!cloudName || !apiKey || !apiSecret) {
    return NextResponse.json({ error: 'Cloudinary não configurado' }, { status: 500 });
  }

  const timestamp = Math.round(Date.now() / 1000);
  const toSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
  const signature = crypto.createHash('sha1').update(toSign).digest('hex');

  return NextResponse.json({ signature, timestamp, folder, cloud_name: cloudName, api_key: apiKey });
}
