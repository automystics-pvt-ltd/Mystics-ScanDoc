import { useState, useEffect } from 'react';
import { useGetSettings, useUpdateSettings, getGetSettingsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Save, Server, Loader2, Mail, CheckCircle2, XCircle, SlidersHorizontal } from 'lucide-react';
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
        toast({ title: "Configuration Applied", description: "System parameters have been updated." });
      },
      onError: (err) => {
        toast({ title: "Configuration Error", description: (err as any).data?.error || "Error applying settings.", variant: "destructive" });
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
        setTestResult({ success: true, message: `Dispatched. Reference ID: ${data.messageId}` });
      } else {
        setTestResult({ success: false, message: data.error || 'Diagnostic dispatch failed' });
      }
    } catch {
      setTestResult({ success: false, message: 'Network layer fault during dispatch' });
    } finally {
      setTestSending(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground font-medium animate-pulse">Initializing settings panel...</div>;
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">System Configuration</h1>
        <p className="text-muted-foreground mt-2">Adjust core parameters and network transport settings.</p>
      </div>

      {/* Resend Integration Status */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 flex items-start gap-4 shadow-sm">
        <div className="bg-primary/10 p-2 rounded-lg shrink-0 border border-primary/10">
          <CheckCircle2 className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-bold text-foreground">API Transport Layer Active</h3>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 uppercase tracking-widest text-[10px] font-bold">Connected</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Outbound traffic is currently routed via the Resend API. Standard SMTP configurations are bypassed.
            You may optionally enforce a specific verified sender identity below.
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card className="border-border shadow-sm overflow-hidden">
            <div className="bg-muted/30 border-b border-border px-6 py-4 flex items-center gap-3">
              <Server className="w-5 h-5 text-primary" />
              <div>
                <h3 className="font-bold text-foreground">Transport Identity</h3>
                <p className="text-xs text-muted-foreground">Define the source address for outbound communications.</p>
              </div>
            </div>
            <CardContent className="p-6">
              <FormField control={form.control} name="smtpUser" render={({ field }) => (
                <FormItem className="max-w-md">
                  <FormLabel className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Origin Address (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="noreply@domain.com" className="font-mono bg-muted/50" {...field} />
                  </FormControl>
                  <FormDescription className="text-xs">
                    Address must be pre-verified with the transport provider. Defaults to <code className="bg-muted px-1.5 py-0.5 rounded border border-border/50 text-foreground">onboarding@resend.dev</code> if omitted.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          {/* Test Email */}
          <Card className="border-border shadow-sm overflow-hidden">
            <div className="bg-muted/30 border-b border-border px-6 py-4 flex items-center gap-3">
              <Mail className="w-5 h-5 text-primary" />
              <div>
                <h3 className="font-bold text-foreground">Diagnostic Dispatch</h3>
                <p className="text-xs text-muted-foreground">Verify end-to-end routing integrity.</p>
              </div>
            </div>
            <CardContent className="p-6 space-y-4">
              <div className="flex gap-3">
                <Input
                  type="email"
                  placeholder="test@domain.com"
                  value={testEmail}
                  onChange={e => setTestEmail(e.target.value)}
                  className="max-w-sm font-mono bg-muted/50"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleTestEmail}
                  disabled={testSending || !testEmail}
                  className="px-6 border border-border font-medium"
                >
                  {testSending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
                  Execute Test
                </Button>
              </div>
              {testResult && (
                <div className={`flex items-start gap-2.5 text-sm rounded-lg p-4 border font-mono ${testResult.success ? 'bg-green-500/5 text-green-700 dark:text-green-400 border-green-500/20' : 'bg-destructive/5 text-destructive border-destructive/20'}`}>
                  {testResult.success
                    ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                    : <XCircle className="w-4 h-4 mt-0.5 shrink-0" />}
                  <span className="font-medium tracking-tight">{testResult.message}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm overflow-hidden">
            <div className="bg-muted/30 border-b border-border px-6 py-4 flex items-center gap-3">
              <SlidersHorizontal className="w-5 h-5 text-primary" />
              <div>
                <h3 className="font-bold text-foreground">Constraints & Quotas</h3>
                <p className="text-xs text-muted-foreground">System-level operational limits.</p>
              </div>
            </div>
            <CardContent className="p-6">
              <div className="grid sm:grid-cols-2 gap-8">
                <FormField control={form.control} name="maxFileSizeMb" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Max Payload Size (MB)</FormLabel>
                    <FormControl><Input type="number" className="font-mono bg-muted/50" {...field} /></FormControl>
                    <FormDescription className="text-xs">Hard limit per transmission.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="maxRecipients" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Global Routing Limit</FormLabel>
                    <FormControl><Input type="number" className="font-mono bg-muted/50" {...field} /></FormControl>
                    <FormDescription className="text-xs">Maximum allowed targets in the registry.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end pt-4">
            <Button type="submit" size="lg" disabled={updateSettings.isPending} className="px-8 font-semibold shadow-lg shadow-primary/20">
              {updateSettings.isPending ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Save className="w-5 h-5 mr-2" />}
              Apply Configuration
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
