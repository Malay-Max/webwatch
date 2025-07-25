// src/app/api/monitor/route.ts
import { monitorAllWebsites } from '@/ai/flows/monitorWebsites';
import { getTelegramSettings } from '@/lib/firestore';
import { NextResponse } from 'next/server';

export const maxDuration = 300; // 5 minutes

async function sendTelegramNotification(botToken: string, chatId: string, text: string) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown',
      }),
    });
    const data = await response.json();
    if (!data.ok) {
      console.error('Telegram API error:', data.description);
    }
  } catch (error) {
    console.error('Failed to send Telegram notification:', error);
  }
}

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const telegramSettings = await getTelegramSettings();
    if (telegramSettings.botToken && telegramSettings.chatId) {
      await sendTelegramNotification(telegramSettings.botToken, telegramSettings.chatId, '🤖 Cron job started. Checking websites for updates...');
    }

    // Do not await this, let it run in the background
    monitorAllWebsites();
    
    return NextResponse.json({ success: true, message: 'Monitoring started.' });
  } catch (error) {
    console.error('Error starting monitoring flow:', error);
    return NextResponse.json({ success: false, message: 'Failed to start monitoring.' }, { status: 500 });
  }
}
