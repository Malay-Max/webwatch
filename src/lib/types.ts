import { Timestamp } from "firebase/firestore";

export type Website = {
  id: string;
  url: string;
  label: string;
  checkInterval: number; // in minutes
  lastChecked: Timestamp;
  status: 'active' | 'inactive' | 'error';
  lastContent: string;
  lastUpdated: Timestamp;
  selector?: string; // Optional CSS selector
};

export type TelegramSettings = {
  botToken: string;
  chatId: string;
};
