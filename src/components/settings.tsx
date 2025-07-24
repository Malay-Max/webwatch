"use client";

import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { getTelegramSettings, saveTelegramSettings } from "@/lib/firestore";

export function Settings() {
  const { toast } = useToast();
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  
  useEffect(() => {
    const fetchSettings = async () => {
      const settings = await getTelegramSettings();
      if (settings) {
        setBotToken(settings.botToken);
        setChatId(settings.chatId);
      }
    };
    fetchSettings();
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await saveTelegramSettings({ botToken, chatId });
      toast({
        title: "Settings Saved",
        description: "Your Telegram configuration has been updated.",
        className: "bg-accent text-accent-foreground",
      });
    } catch (error) {
       toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive"
      });
    }
  };

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle>Telegram Bot Configuration</CardTitle>
          <CardDescription>
            Enter your Telegram bot token and chat ID to receive notifications.
            You can get these from BotFather on Telegram.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="token">Bot Token</Label>
            <Input
              id="token"
              type="password"
              placeholder="Enter your bot token"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="chatId">Chat ID</Label>
            <Input
              id="chatId"
              placeholder="Enter your chat ID"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit">Save Settings</Button>
        </CardFooter>
      </form>
    </Card>
  );
}
