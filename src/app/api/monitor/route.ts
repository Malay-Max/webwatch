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
    // Do not await this, let it run in the background
    monitorAllWebsites();
    return NextResponse.json({ success: true, message: 'Monitoring started.' });
  } catch (error) {
    console.error('Error starting monitoring flow:', error);
    return NextResponse.json({ success: false, message: 'Failed to start monitoring.' }, { status: 500 });
  }
}