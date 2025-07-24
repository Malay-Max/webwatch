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


const formSchema = z.object({
  url: z.string().url({ message: 'Please enter a valid URL.' }),
  label: z.string().min(1, { message: 'Label is required.' }),
  checkInterval: z.string(),
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

  useEffect(() => {
    const fetchWebsites = async () => {
      const websitesFromDb = await getWebsites();
      setWebsites(websitesFromDb);
    };
    fetchWebsites();
  }, []);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { url: '', label: '', checkInterval: '10' },
  });

  const handleEdit = (website: Website) => {
    setEditingWebsite(website);
    form.reset({
      url: website.url,
      label: website.label,
      checkInterval: String(website.checkInterval),
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

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      if (editingWebsite) {
        const updatedWebsiteData: Partial<Website> = {
          url: values.url,
          label: values.label,
          checkInterval: parseInt(values.checkInterval, 10),
        };
        await updateWebsite(editingWebsite.id, updatedWebsiteData);
        setWebsites(websites.map(w => w.id === editingWebsite.id ? { ...w, ...updatedWebsiteData } as Website : w));
        toast({ title: "Website Updated", description: "Your website settings have been saved." });
      } else {
        const newWebsiteData: Omit<Website, 'id' | 'status' | 'lastChecked'> = {
          url: values.url,
          label: values.label,
          checkInterval: parseInt(values.checkInterval, 10),
        };
        const fullWebsiteData = {
          ...newWebsiteData,
          lastChecked: Timestamp.now(),
          status: 'inactive' as const,
        }
        const newId = await addWebsite(fullWebsiteData);
        const newWebsite = { ...fullWebsiteData, id: newId };

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
                <TableHead className="hidden md:table-cell">Interval</TableHead>
                <TableHead className="hidden md:table-cell">Last Checked</TableHead>
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
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("flex items-center gap-2 w-fit", statusConfig[website.status].className)}>
                        {statusConfig[website.status].icon}
                        <span>{statusConfig[website.status].label}</span>
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{website.checkInterval} mins</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {website.lastChecked && formatDistanceToNow(website.lastChecked.toDate(), { addSuffix: true })}
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
                  <TableCell colSpan={5} className="h-24 text-center">
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
                      <Input placeholder="e.g. My Personal Blog" {...field} />
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
