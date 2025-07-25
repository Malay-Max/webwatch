
// src/app/api/monitor/route.ts
import { monitorAllWebsites } from '@/ai/flows/monitorWebsites';
import { NextResponse } from 'next/server';

export const maxDuration = 300; // 5 minutes

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    // Await the monitoring flow to ensure it completes
    await monitorAllWebsites();
    
    return NextResponse.json({ success: true, message: 'Monitoring completed.' });
  } catch (error) {
    console.error('Error during monitoring flow:', error);
    return NextResponse.json({ success: false, message: 'Monitoring failed.' }, { status: 500 });
  }
}
