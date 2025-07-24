'use server';
/**
 * @fileOverview This flow monitors websites for content changes and sends notifications to Telegram.
 * 
 * - monitorAllWebsites - The main flow that orchestrates the monitoring process.
 */

import { ai } from '@/ai/genkit';
import { getTelegramSettings, getWebsitesToMonitor, updateWebsite } from '@/lib/firestore';
import { Website } from '@/lib/types';
import { Timestamp } from 'firebase/firestore';
import { z } from 'zod';

const ChangeDetectionSchema = z.object({
  changeDetected: z.boolean().describe('Whether a significant change was detected.'),
  summary: z.string().optional().describe('A summary of the changes if any were detected.'),
});

const changeDetectionPrompt = ai.definePrompt({
  name: 'changeDetectionPrompt',
  input: {
    schema: z.object({
      url: z.string(),
      oldContent: z.string(),
      newContent: z.string(),
    }),
  },
  output: { schema: ChangeDetectionSchema },
  prompt: `
You are a website monitoring agent. Your task is to compare two versions of a website's HTML content and determine if there have been significant changes.

- Ignore minor changes like timestamps, ads, or dynamic content that changes on every load.
- Focus on substantive changes to the main content, such as new articles, updated text, or significant layout modifications.

Analyze the old and new content for the website at {{url}} and provide a summary of the changes.

Old Content (first 5000 characters):
\`\`\`html
{{{oldContent}}}
\`\`\`

New Content (first 5000 characters):
\`\`\`html
{{{newContent}}}
\`\`\`
`,
});

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

async function processWebsite(website: Website, telegramSettings: { botToken: string, chatId: string }): Promise<void> {
  try {
    const response = await fetch(website.url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' }
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch ${website.url}: ${response.statusText}`);
    }
    const newContent = await response.text();
    const now = Timestamp.now();

    if (website.lastContent && website.lastContent !== newContent) {
      const { output } = await changeDetectionPrompt({
        url: website.url,
        oldContent: website.lastContent.substring(0, 5000),
        newContent: newContent.substring(0, 5000),
      });

      if (output?.changeDetected && output.summary) {
        const message = `*Change Detected on ${website.label}*\n\n${output.summary}\n\n[View Website](${website.url})`;
        await sendTelegramNotification(telegramSettings.botToken, telegramSettings.chatId, message);
        await updateWebsite(website.id, {
          lastContent: newContent,
          lastChecked: now,
          lastUpdated: now,
          status: 'active',
        });
      } else {
        await updateWebsite(website.id, { lastChecked: now, status: 'active' });
      }
    } else {
       await updateWebsite(website.id, { 
         lastContent: newContent,
         lastChecked: now,
         status: 'active'
       });
    }
  } catch (error) {
    console.error(`Error processing ${website.url}:`, error);
    await updateWebsite(website.id, { status: 'error', lastChecked: Timestamp.now() });
  }
}

export const monitorAllWebsites = ai.defineFlow(
  {
    name: 'monitorAllWebsites',
    inputSchema: z.void(),
    outputSchema: z.void(),
  },
  async () => {
    console.log('Starting website monitoring flow...');
    const now = new Date();
    // Check for websites that are due for a check
    const websitesToCheck = await getWebsitesToMonitor(new Date(now.getTime() - 5 * 60 * 1000 /* 5 minutes ago */));
    const telegramSettings = await getTelegramSettings();
    
    if (!telegramSettings || !telegramSettings.botToken || !telegramSettings.chatId) {
        console.error("Telegram settings are not configured. Aborting flow.");
        return;
    }
    
    if (websitesToCheck.length === 0) {
        console.log("No websites are due for monitoring at this time.");
        return;
    }

    console.log(`Found ${websitesToCheck.length} websites to monitor.`);

    for (const website of websitesToCheck) {
        const lastCheckedTime = website.lastChecked.toDate().getTime();
        const intervalMillis = website.checkInterval * 60 * 1000;
        if (now.getTime() - lastCheckedTime >= intervalMillis) {
            await processWebsite(website, telegramSettings);
        }
    }
    console.log('Website monitoring flow finished.');
  }
);
