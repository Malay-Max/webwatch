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

export function Settings() {
  const { toast } = useToast();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    toast({
      title: "Settings Saved",
      description: "Your Telegram configuration has been updated.",
      className: "bg-accent text-accent-foreground",
    });
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
              defaultValue="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="chatId">Chat ID</Label>
            <Input
              id="chatId"
              placeholder="Enter your chat ID"
              defaultValue="-1001234567890"
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
