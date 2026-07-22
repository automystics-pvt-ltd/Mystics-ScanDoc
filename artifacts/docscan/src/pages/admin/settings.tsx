import { useState, useEffect } from 'react';
import { useGetSettings, useUpdateSettings, getGetSettingsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Save, Server, Loader2, Mail, CheckCircle2, XCircle, SlidersHorizontal, ShieldAlert } from 'lucide-react';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    return <div className="p-8 text-center text-muted-foreground">Initializing settings panel...</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

      <div className="bg-card border border-border rounded-lg p-5 flex items-start gap-4 shadow-sm">
        <div className="bg-primary/10 p-2 rounded shrink-0">
          <Server className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-foreground">API Transport Active</h3>
            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-0 uppercase tracking-widest text-[10px] font-bold">Connected</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Outbound traffic is routed via the Resend API. Standard SMTP configurations are bypassed.
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader className="bg-muted/30 border-b border-border pb-4 pt-5">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-muted-foreground" /> Transport Identity
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <FormField control={form.control} name="smtpUser" render={({ field }) => (
                <FormItem className="max-w-md">
                  <FormLabel className="text-xs uppercase font-semibold text-muted-foreground">Origin Address (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="noreply@domain.com" className="font-mono bg-background" {...field} />
                  </FormControl>
                  <FormDescription className="text-xs">
                    Address must be verified with the transport provider. Defaults to <code className="bg-muted px-1 py-0.5 rounded text-foreground">onboarding@resend.dev</code>
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="bg-muted/30 border-b border-border pb-4 pt-5">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-muted-foreground" /> Constraints & Quotas
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 grid sm:grid-cols-2 gap-8">
              <FormField control={form.control} name="maxFileSizeMb" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs uppercase font-semibold text-muted-foreground">Max Payload Size (MB)</FormLabel>
                  <FormControl><Input type="number" className="font-mono bg-background" {...field} /></FormControl>
                  <FormDescription className="text-xs">Hard limit per transmission.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="maxRecipients" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs uppercase font-semibold text-muted-foreground">Global Routing Limit</FormLabel>
                  <FormControl><Input type="number" className="font-mono bg-background" {...field} /></FormControl>
                  <FormDescription className="text-xs">Max targets per dispatch.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" disabled={updateSettings.isPending}>
              {updateSettings.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Configuration
            </Button>
          </div>
        </form>
      </Form>

      <Card className="shadow-sm mt-8">
        <CardHeader className="bg-muted/30 border-b border-border pb-4 pt-5">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Mail className="w-4 h-4 text-muted-foreground" /> Diagnostic Dispatch
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="flex gap-3">
            <Input
              type="email"
              placeholder="test@domain.com"
              value={testEmail}
              onChange={e => setTestEmail(e.target.value)}
              className="max-w-sm font-mono bg-background"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={handleTestEmail}
              disabled={testSending || !testEmail}
            >
              {testSending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
              Execute Test
            </Button>
          </div>
          {testResult && (
            <div className={`flex items-center gap-2 text-sm rounded p-3 border font-mono ${testResult.success ? 'bg-green-500/10 text-green-700 border-green-500/20' : 'bg-destructive/10 text-destructive border-destructive/20'}`}>
              {testResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
              <span className="font-medium truncate">{testResult.message}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
