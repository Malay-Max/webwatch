"use client";

import { useEffect, useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { formatDistanceToNow } from 'date-fns';
import {
  AlertTriangle,
  CheckCircle2,
  MoreHorizontal,
  Pencil,
  PlusCircle,
  RefreshCw,
  Trash2,
  XCircle,
} from 'lucide-react';
import type { Website } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { addWebsite, deleteWebsite, getWebsites, updateWebsite } from '@/lib/firestore';
import { Timestamp } from 'firebase/firestore';
import { monitorSingleWebsite } from '@/ai/flows/monitorWebsites';


const formSchema = z.object({
  url: z.string().url({ message: 'Please enter a valid URL.' }),
  label: z.string().min(1, { message: 'Label is required.' }),
  checkInterval: z.string(),
  selector: z.string().optional(),
});

const statusConfig = {
  active: {
    icon: <CheckCircle2 className="h-4 w-4" />,
    label: 'Active',
    className: 'bg-accent text-accent-foreground',
  },
  inactive: {
    icon: <XCircle className="h-4 w-4" />,
    label: 'Inactive',
    className: 'bg-secondary text-secondary-foreground',
  },
  error: {
    icon: <AlertTriangle className="h-4 w-4" />,
    label: 'Error',
    className: 'bg-destructive/20 text-destructive',
  },
};

export function Dashboard() {
  const [websites, setWebsites] = useState<Website[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingWebsite, setEditingWebsite] = useState<Website | null>(null);
  const { toast } = useToast();

  const fetchWebsites = async () => {
    const websitesFromDb = await getWebsites();
    setWebsites(websitesFromDb);
  };
  
  useEffect(() => {
    fetchWebsites();
    const interval = setInterval(fetchWebsites, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { url: '', label: '', checkInterval: '10', selector: '' },
  });

  const handleEdit = (website: Website) => {
    setEditingWebsite(website);
    form.reset({
      url: website.url,
      label: website.label,
      checkInterval: String(website.checkInterval),
      selector: website.selector || '',
    });
    setIsDialogOpen(true);
  };
  
  const handleDelete = async (id: string) => {
    try {
      await deleteWebsite(id);
      setWebsites((prevWebsites) => prevWebsites.filter((w) => w.id !== id));
      toast({
        title: "Website Removed",
        description: "The website has been removed from monitoring.",
      });
    } catch (error) {
       toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleCheckNow = async (website: Website) => {
    toast({
      title: 'Checking Website...',
      description: `Manually checking ${website.label} for changes.`,
    });
    try {
      const result = await monitorSingleWebsite(website.id);
      await fetchWebsites(); // Refresh the list to show updated status/time
      if (result.changed) {
        toast({
          title: "New Notice Found!",
          description: result.summary,
          className: "bg-accent text-accent-foreground",
        });
      } else {
        toast({
          title: "No Changes Detected",
          description: `Finished checking ${website.label}.`,
        });
      }
    } catch (error) {
      await fetchWebsites(); // Refresh even on error
      toast({
        title: 'Error Checking Website',
        description: error instanceof Error ? error.message : "An unknown error occurred.",
        variant: 'destructive',
      });
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      if (editingWebsite) {
        const updatedWebsiteData: Partial<Website> = {
          url: values.url,
          label: values.label,
          checkInterval: parseInt(values.checkInterval, 10),
          selector: values.selector || '',
        };
        await updateWebsite(editingWebsite.id, updatedWebsiteData);
        await fetchWebsites();
        toast({ title: "Website Updated", description: "Your website settings have been saved." });
      } else {
        const newWebsiteData: Omit<Website, 'id'> = {
          url: values.url,
          label: values.label,
          checkInterval: parseInt(values.checkInterval, 10),
          lastChecked: Timestamp.fromMillis(0),
          lastUpdated: Timestamp.fromMillis(0),
          status: 'inactive' as const,
          lastContent: '',
          selector: values.selector || '',
          lastChangeSummary: '',
        };
        const newId = await addWebsite(newWebsiteData);
        const newWebsite = { ...newWebsiteData, id: newId };

        setWebsites(prevWebsites => [newWebsite, ...prevWebsites]);
        toast({ title: "Website Added", description: "The new website is now being monitored." });
      }

      setIsDialogOpen(false);
      setEditingWebsite(null);
      form.reset();
    } catch (error) {
       toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive"
      });
    }
  };
  
  const handleOpenChange = (open: boolean) => {
    if(!open) {
      setEditingWebsite(null);
      form.reset();
    }
    setIsDialogOpen(open);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Monitored Websites</CardTitle>
            <CardDescription>A list of your websites being monitored for changes.</CardDescription>
          </div>
          <Button onClick={() => handleOpenChange(true)}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add Website
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Website</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">Interval</TableHead>
                <TableHead className="hidden md:table-cell">Last Checked</TableHead>
                <TableHead className="hidden lg:table-cell">Latest Update</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {websites.length > 0 ? (
                websites.map((website) => (
                  <TableRow key={website.id}>
                    <TableCell>
                      <div className="font-medium">{website.label}</div>
                      <div className="text-sm text-muted-foreground">{website.url}</div>
                      {website.selector && <div className="text-xs text-muted-foreground/80 font-mono mt-1">Selector: {website.selector}</div>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("flex items-center gap-2 w-fit", statusConfig[website.status]?.className)}>
                        {statusConfig[website.status]?.icon}
                        <span>{statusConfig[website.status]?.label}</span>
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">{website.checkInterval} mins</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {website.lastChecked && website.lastChecked.toMillis() > 0 ? formatDistanceToNow(website.lastChecked.toDate(), { addSuffix: true }) : 'Never'}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground truncate max-w-[200px]">
                      {website.lastChangeSummary || 'No changes yet.'}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button aria-haspopup="true" size="icon" variant="ghost">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Toggle menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleCheckNow(website)}>
                            <RefreshCw className="mr-2 h-4 w-4" /> Check Now
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEdit(website)}>
                            <Pencil className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(website.id)} className="text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    No websites added yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingWebsite ? 'Edit Website' : 'Add New Website'}</DialogTitle>
            <DialogDescription>
              {editingWebsite ? 'Update the details of your website.' : 'Enter the details of the website you want to monitor.'}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
              <FormField
                control={form.control}
                name="label"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Label</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. My University Notices" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="selector"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CSS Selector (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. #notice-board or .main-content" {...field} />
                    </FormControl>
                     <FormDescription>
                      Specify a tag like `main` or a CSS selector like `#content` to monitor only a specific part of the page.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="checkInterval"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Check Interval</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select check interval" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="5">5 minutes</SelectItem>
                        <SelectItem value="10">10 minutes</SelectItem>
                        <SelectItem value="30">30 minutes</SelectItem>
                        <SelectItem value="60">1 hour</SelectItem>
                        <SelectItem value="360">6 hours</SelectItem>
                        <SelectItem value="1440">1 day</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>Cancel</Button>
                <Button type="submit">Save Website</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
