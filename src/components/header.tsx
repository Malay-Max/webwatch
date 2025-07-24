import { Bot } from 'lucide-react';

export function Header() {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-4 sm:px-6">
      <div className="flex items-center gap-2">
        <Bot className="h-8 w-8 text-primary" />
        <h1 className="text-xl font-bold tracking-tight">
          WebWatch Telegram Notifier
        </h1>
      </div>
    </header>
  );
}
