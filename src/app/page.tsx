import { Dashboard } from '@/components/dashboard';
import { Header } from '@/components/header';
import { Settings } from '@/components/settings';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bot, LayoutDashboard } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <Header />
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:max-w-md">
            <TabsTrigger value="dashboard">
              <LayoutDashboard className="mr-2 h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Bot className="mr-2 h-4 w-4" />
              Telegram Settings
            </TabsTrigger>
          </TabsList>
          <TabsContent value="dashboard" className="mt-4">
            <Dashboard />
          </TabsContent>
          <TabsContent value="settings" className="mt-4">
            <Settings />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
