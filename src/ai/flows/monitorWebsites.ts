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
You are an expert at monitoring university and college noticeboards. Your task is to find the title of any new notice or announcement.

- Compare the old and new HTML content to identify newly added notices.
- If a new notice is found, extract its exact title.
- If there are multiple new notices, list each title on a new line.
- If no new notices are found, simply report that no change was detected.

Analyze the old and new content for the website at {{url}}.

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

    if (website.status === 'inactive' || !website.lastContent) {
      await updateWebsite(website.id, { 
        lastContent: newContent,
        lastChecked: now,
        status: 'active'
      });
      return;
    }

    if (website.lastContent && website.lastContent !== newContent) {
      const { output } = await changeDetectionPrompt({
        url: website.url,
        oldContent: website.lastContent.substring(0, 5000),
        newContent: newContent.substring(0, 5000),
      });

      if (output?.changeDetected && output.summary) {
        const message = `*New Notice on ${website.label}*\n\n${output.summary}\n\n[View Website](${website.url})`;
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
    } else { // No change, just update the last checked time
        await updateWebsite(website.id, { lastChecked: now });
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
    const websitesToCheck = await getWebsitesToMonitor(now); 
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
        if (website.status === 'inactive') {
            await processWebsite(website, telegramSettings);
            continue;
        }

        const lastCheckedTime = website.lastChecked.toDate().getTime();
        const intervalMillis = website.checkInterval * 60 * 1000;
        
        if (now.getTime() - lastCheckedTime >= intervalMillis) {
            await processWebsite(website, telegramSettings);
        }
    }
    console.log('Website monitoring flow finished.');
  }
);
