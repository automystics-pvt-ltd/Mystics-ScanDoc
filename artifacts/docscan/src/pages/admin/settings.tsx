import { useEffect } from 'react';
import { useGetSettings, useUpdateSettings, getGetSettingsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Save, Server, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const settingsSchema = z.object({
  smtpHost: z.string().optional(),
  smtpPort: z.coerce.number().optional(),
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),
  maxRecipients: z.coerce.number().min(1).max(10),
  maxFileSizeMb: z.coerce.number().min(1).max(50),
});

export default function Settings() {
  const { data: settings, isLoading } = useGetSettings();
  const updateSettings = useUpdateSettings();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof settingsSchema>>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      smtpHost: "",
      smtpPort: 587,
      smtpUser: "",
      smtpPass: "",
      maxRecipients: 5,
      maxFileSizeMb: 10,
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        smtpHost: settings.smtpHost || "",
        smtpPort: settings.smtpPort || 587,
        smtpUser: settings.smtpUser || "",
        smtpPass: settings.smtpPass || "",
        maxRecipients: settings.maxRecipients,
        maxFileSizeMb: settings.maxFileSizeMb,
      });
    }
  }, [settings, form]);

  const onSubmit = (values: z.infer<typeof settingsSchema>) => {
    updateSettings.mutate({ data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
        toast({ title: "Settings saved successfully" });
      },
      onError: (err) => {
        toast({ title: "Failed to save settings", description: (err as any).data?.error || "Error", variant: "destructive" });
      }
    });
  };

  if (isLoading) {
    return <div className="p-8 text-center">Loading settings...</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">System Settings</h1>
        <p className="text-muted-foreground mt-2">Configure email delivery and system limits.</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="w-5 h-5 text-primary" />
                SMTP Configuration
              </CardTitle>
              <CardDescription>Email server details for sending documents.</CardDescription>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-6">
              <FormField control={form.control} name="smtpHost" render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>SMTP Host</FormLabel>
                  <FormControl><Input placeholder="smtp.mailgun.org" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="smtpPort" render={({ field }) => (
                <FormItem>
                  <FormLabel>SMTP Port</FormLabel>
                  <FormControl><Input type="number" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="sm:col-span-2 grid sm:grid-cols-2 gap-6 mt-2">
                <FormField control={form.control} name="smtpUser" render={({ field }) => (
                  <FormItem>
                    <FormLabel>SMTP Username</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="smtpPass" render={({ field }) => (
                  <FormItem>
                    <FormLabel>SMTP Password</FormLabel>
                    <FormControl><Input type="password" placeholder="••••••••" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>System Limits</CardTitle>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-6">
              <FormField control={form.control} name="maxFileSizeMb" render={({ field }) => (
                <FormItem>
                  <FormLabel>Max File Size (MB)</FormLabel>
                  <FormControl><Input type="number" {...field} /></FormControl>
                  <FormDescription>Maximum size per document upload.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="maxRecipients" render={({ field }) => (
                <FormItem>
                  <FormLabel>Max Recipients</FormLabel>
                  <FormControl><Input type="number" {...field} /></FormControl>
                  <FormDescription>Global limit on configured recipients.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" size="lg" disabled={updateSettings.isPending}>
              {updateSettings.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Settings
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}