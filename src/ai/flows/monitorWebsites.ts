'use server';
/**
 * @fileOverview This flow monitors websites for content changes and sends notifications to Telegram.
 * 
 * - monitorAllWebsites - The main flow that orchestrates the monitoring process.
 */

import { ai } from '@/ai/genkit';
import { getTelegramSettings, getWebsite, getWebsitesToMonitor, updateWebsite } from '@/lib/firestore';
import { Website } from '@/lib/types';
import { Timestamp } from 'firebase/firestore';
import { z } from 'zod';

const ChangeDetectionSchema = z.object({
  changeDetected: z.boolean().describe('Whether a significant change was detected.'),
  summary: z.string().optional().describe('A summary of the changes if any were detected.'),
});

const InitialNoticeSchema = z.object({
    noticeFound: z.boolean().describe('Whether a notice was found.'),
    summary: z.string().optional().describe('The title of the most recent notice.'),
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

Old Content:
\`\`\`html
{{{oldContent}}}
\`\`\`

New Content:
\`\`\`html
{{{newContent}}}
\`\`\`
`,
});

const initialNoticePrompt = ai.definePrompt({
  name: 'initialNoticePrompt',
  input: {
    schema: z.object({
      url: z.string(),
      content: z.string(),
    }),
  },
  output: { schema: InitialNoticeSchema },
  prompt: `
You are an expert at monitoring university and college noticeboards. Your task is to find the title of the most recent notice or announcement from the provided HTML content.

- Analyze the HTML to find the latest notice.
- Extract its exact title.
- If no notice is found, simply report that no notice was found.

Analyze the content for the website at {{url}}.

Content:
\`\`\`html
{{{content}}}
\`\`\`
`,
});

function extractContentBySelector(html: string, selector: string): string {
    // Basic regex for a specific tag or a class/id.
    // This is a simplified approach and won't handle complex nested structures
    // or advanced CSS selectors as a full DOM parser would.
    const sanitizedSelector = selector.trim();
    let regex;

    if (sanitizedSelector.startsWith('.')) {
        // Class selector
        const className = sanitizedSelector.substring(1);
        regex = new RegExp(`<[^>]+class="[^"]*${className}[^"]*"[^>]*>([\\s\\S]*?)<\\/[^>]+>`, 'i');
    } else if (sanitizedSelector.startsWith('#')) {
        // ID selector
        const id = sanitizedSelector.substring(1);
        regex = new RegExp(`<[^>]+id="${id}"[^>]*>([\\s\\S]*?)<\\/[^>]+>`, 'i');
    } else {
        // Tag selector
        regex = new RegExp(`<${sanitizedSelector}[^>]*>([\\s\\S]*?)<\\/${sanitizedSelector}>`, 'i');
    }

    const match = html.match(regex);
    return match ? match[1] || match[0] : html; // Return content or the full tag, fallback to full html
}


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

async function processWebsite(website: Website, telegramSettings: { botToken: string, chatId: string }): Promise<{ changed: boolean, summary?: string }> {
  try {
    const response = await fetch(website.url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' }
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch ${website.url}: ${response.statusText}`);
    }
    const rawHtml = await response.text();
    const newContent = website.selector ? extractContentBySelector(rawHtml, website.selector) : rawHtml;
    const now = Timestamp.now();

    if (website.status === 'inactive' || !website.lastContent) {
      // First time checking this website
      const { output } = await initialNoticePrompt({
        url: website.url,
        content: newContent.substring(0, 5000),
      });

      if (output?.noticeFound && output.summary) {
        const message = `*Latest Notice on ${website.label}*\n\n${output.summary}\n\n[View Website](${website.url})`;
        await sendTelegramNotification(telegramSettings.botToken, telegramSettings.chatId, message);
      }
      
      await updateWebsite(website.id, { 
        lastContent: newContent,
        lastChecked: now,
        status: 'active',
        lastUpdated: now,
      });

      const summary = output?.noticeFound ? `Initial notice found: ${output.summary}` : "Website activated. Monitoring will start on the next check.";
      return { changed: output?.noticeFound || false, summary: summary };
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
        return { changed: true, summary: output.summary };
      } else {
        await updateWebsite(website.id, { lastChecked: now, status: 'active' });
        return { changed: false, summary: 'No changes detected.' };
      }
    } else { // No change, just update the last checked time
        await updateWebsite(website.id, { lastChecked: now });
        return { changed: false, summary: 'No changes detected.' };
    }
  } catch (error) {
    console.error(`Error processing ${website.url}:`, error);
    await updateWebsite(website.id, { status: 'error', lastChecked: Timestamp.now() });
    throw error;
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
        // Always process inactive websites to get their initial state
        if (website.status === 'inactive') {
            console.log(`Processing inactive website: ${website.label}`);
            await processWebsite(website, telegramSettings);
            continue;
        }

        const lastCheckedTime = website.lastChecked.toDate().getTime();
        const intervalMillis = website.checkInterval * 60 * 1000;
        
        // Check if the interval has passed
        if (now.getTime() - lastCheckedTime >= intervalMillis) {
            console.log(`Processing website due for check: ${website.label}`);
            await processWebsite(website, telegramSettings);
        } else {
            // Optional: log sites that are not yet due
            // console.log(`Skipping website (not due yet): ${website.label}`);
        }
    }
    console.log('Website monitoring flow finished.');
  }
);


export async function monitorSingleWebsite(websiteId: string): Promise<{ changed: boolean, summary?: string }> {
    const website = await getWebsite(websiteId);
    if (!website) {
        throw new Error('Website not found');
    }
    const telegramSettings = await getTelegramSettings();
    if (!telegramSettings || !telegramSettings.botToken || !telegramSettings.chatId) {
        throw new Error("Telegram settings are not configured.");
    }
    
    return await processWebsite(website, telegramSettings);
}
