import { useState, useEffect } from 'react';
import { useGetSettings, useUpdateSettings, getGetSettingsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Save, Server, Loader2, Mail, CheckCircle2, XCircle } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { getApiUrl } from '@/lib/api';

const settingsSchema = z.object({
  smtpUser: z.string().optional(),
  maxRecipients: z.coerce.number().min(1).max(10),
  maxFileSizeMb: z.coerce.number().min(1).max(50),
});

export default function Settings() {
  const { data: settings, isLoading } = useGetSettings();
  const updateSettings = useUpdateSettings();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [testEmail, setTestEmail] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const form = useForm<z.infer<typeof settingsSchema>>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      smtpUser: "",
      maxRecipients: 5,
      maxFileSizeMb: 10,
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        smtpUser: settings.smtpUser || "",
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

  const handleTestEmail = async () => {
    if (!testEmail) return;
    setTestSending(true);
    setTestResult(null);
    try {
      const res = await fetch(`${getApiUrl()}admin/test-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ to: testEmail }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({ success: true, message: `Email sent! Message ID: ${data.messageId}` });
      } else {
        setTestResult({ success: false, message: data.error || 'Failed to send test email' });
      }
    } catch {
      setTestResult({ success: false, message: 'Network error sending test email' });
    } finally {
      setTestSending(false);
    }
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

      {/* Resend Integration Status */}
      <Card className="border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            Resend Integration Active
            <Badge variant="secondary" className="ml-auto bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Connected</Badge>
          </CardTitle>
          <CardDescription>
            Emails are delivered via the Resend API. No manual SMTP configuration needed.
            Optionally set a custom "From" address below (must be verified in your Resend account).
          </CardDescription>
        </CardHeader>
      </Card>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="w-5 h-5 text-primary" />
                Email Configuration
              </CardTitle>
              <CardDescription>Optional: set a verified sender address. Leave blank to use the default Resend address.</CardDescription>
            </CardHeader>
            <CardContent>
              <FormField control={form.control} name="smtpUser" render={({ field }) => (
                <FormItem>
                  <FormLabel>From Address (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="noreply@yourdomain.com" {...field} />
                  </FormControl>
                  <FormDescription>
                    Must be a verified sender in your Resend account. Leave blank to use <code className="text-xs bg-muted px-1 py-0.5 rounded">onboarding@resend.dev</code>.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          {/* Test Email */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-primary" />
                Send Test Email
              </CardTitle>
              <CardDescription>Verify email delivery is working end-to-end.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={testEmail}
                  onChange={e => setTestEmail(e.target.value)}
                  className="max-w-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTestEmail}
                  disabled={testSending || !testEmail}
                >
                  {testSending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
                  Send Test
                </Button>
              </div>
              {testResult && (
                <div className={`flex items-start gap-2 text-sm rounded-md p-3 ${testResult.success ? 'bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-200' : 'bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-200'}`}>
                  {testResult.success
                    ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                    : <XCircle className="w-4 h-4 mt-0.5 shrink-0" />}
                  {testResult.message}
                </div>
              )}
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
