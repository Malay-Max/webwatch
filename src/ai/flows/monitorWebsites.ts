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
import { parse } from 'node-html-parser';

type TelegramSettings = {
    botToken: string;
    chatId: string;
};

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
    if (!selector) {
        return html;
    }
    try {
        const root = parse(html);
        const element = root.querySelector(selector);
        return element ? element.innerHTML : html; // Fallback to full html if selector not found
    } catch (error) {
        console.error(`Error parsing HTML for selector "${selector}":`, error);
        return html; // Fallback on error
    }
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

async function processWebsite(website: Website, telegramSettings: TelegramSettings): Promise<{ changed: boolean, summary?: string, content?: string }> {
  try {
    const response = await fetch(website.url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Connection': 'keep-alive',
        }
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch ${website.url}: ${response.status} ${response.statusText}`);
    }
    const rawHtml = await response.text();
    const newContent = extractContentBySelector(rawHtml, website.selector || '');
    const now = Timestamp.now();

    if (website.status === 'inactive' || !website.lastContent) {
      // First time checking this website
      const { output } = await initialNoticePrompt({
        url: website.url,
        content: newContent.substring(0, 8000), // Increased substring limit
      });
      
      const summary = output?.noticeFound ? `Initial notice found: ${output.summary}` : "Website activated. Monitoring will start on the next check.";
      const updatePayload: Partial<Website> = { 
        lastContent: newContent,
        lastChecked: now,
        status: 'active',
        lastUpdated: now,
      };

      if (output?.noticeFound && output.summary) {
        updatePayload.lastChangeSummary = output.summary;
        const message = `*Latest Notice on ${website.label}*\n\n${output.summary}\n\n[View Website](${website.url})`;
        await sendTelegramNotification(telegramSettings.botToken, telegramSettings.chatId, message);
      } else {
        updatePayload.lastChangeSummary = 'No notice found on first check.';
      }
      
      await updateWebsite(website.id, updatePayload);

      return { changed: output?.noticeFound || false, summary: summary, content: newContent };
    }

    if (website.lastContent && website.lastContent !== newContent) {
      const { output } = await changeDetectionPrompt({
        url: website.url,
        oldContent: website.lastContent.substring(0, 8000),
        newContent: newContent.substring(0, 8000),
      });

      if (output?.changeDetected && output.summary) {
        const message = `*New Notice on ${website.label}*\n\n${output.summary}\n\n[View Website](${website.url})`;
        await sendTelegramNotification(telegramSettings.botToken, telegramSettings.chatId, message);
        await updateWebsite(website.id, {
          lastContent: newContent,
          lastChecked: now,
          lastUpdated: now,
          status: 'active',
          lastChangeSummary: output.summary,
        });
        return { changed: true, summary: output.summary, content: newContent };
      } else {
        await updateWebsite(website.id, { lastChecked: now, status: 'active' });
        return { changed: false, summary: 'No changes detected.', content: newContent };
      }
    } else { // No change, just update the last checked time
        await updateWebsite(website.id, { lastChecked: now });
        return { changed: false, summary: 'No changes detected.', content: newContent };
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
        console.error("Telegram settings are not configured. Aborting flow. Please check your environment variables.");
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
            await processWebsite(website, telegramSettings as TelegramSettings);
            continue;
        }

        const lastCheckedTime = website.lastChecked.toDate().getTime();
        const intervalMillis = website.checkInterval * 60 * 1000;
        
        // Check if the interval has passed
        if (now.getTime() - lastCheckedTime >= intervalMillis) {
            console.log(`Processing website due for check: ${website.label}`);
            await processWebsite(website, telegramSettings as TelegramSettings);
        } else {
            // Optional: log sites that are not yet due
            // console.log(`Skipping website (not due yet): ${website.label}`);
        }
    }
    console.log('Website monitoring flow finished.');
  }
);


export async function monitorSingleWebsite(websiteId: string): Promise<{ changed: boolean, summary?: string, content?: string }> {
    const website = await getWebsite(websiteId);
    if (!website) {
        throw new Error('Website not found');
    }
    const telegramSettings = await getTelegramSettings();
    if (!telegramSettings || !telegramSettings.botToken || !telegramSettings.chatId) {
        throw new Error("Telegram settings are not configured. Please check your environment variables.");
    }
    
    return await processWebsite(website, telegramSettings as TelegramSettings);
}
