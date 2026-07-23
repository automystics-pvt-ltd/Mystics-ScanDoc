import { useState, useEffect } from 'react';
import { useGetSettings, useUpdateSettings, getGetSettingsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Save, Server, Loader2, Mail, CheckCircle2, XCircle,
  SlidersHorizontal, ShieldAlert, AlertTriangle, ScanLine,
  Camera, FileType, MessageSquare, Phone, Clock,
  Printer, Zap, Eye, EyeOff, RefreshCw, Link, Copy, RotateCcw, Wifi,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getApiUrl } from '@/lib/api';
import { cn } from '@/lib/utils';

// ── Constants ────────────────────────────────────────────────────────────────

const EMAIL_PROVIDERS = [
  { id: 'resend', name: 'Resend', desc: 'Transactional email API', color: 'bg-black text-white' },
  { id: 'sendgrid', name: 'SendGrid', desc: 'Twilio SendGrid', color: 'bg-blue-600 text-white' },
  { id: 'mailgun', name: 'Mailgun', desc: 'Mailgun email API', color: 'bg-red-600 text-white' },
  { id: 'ses', name: 'AWS SES', desc: 'Amazon Simple Email Service', color: 'bg-orange-500 text-white' },
  { id: 'postmark', name: 'Postmark', desc: 'Postmark transactional email', color: 'bg-yellow-500 text-black' },
  { id: 'smtp', name: 'Custom SMTP', desc: 'Any SMTP server', color: 'bg-muted text-foreground border' },
];

const SMS_PROVIDERS = [
  { id: 'twilio', name: 'Twilio', desc: 'Industry-leading SMS API' },
  { id: 'vonage', name: 'Vonage', desc: 'Vonage SMS (formerly Nexmo)' },
  { id: 'messagebird', name: 'MessageBird', desc: 'MessageBird SMS' },
];

const WHATSAPP_PROVIDERS = [
  { id: 'twilio', name: 'Twilio WhatsApp', desc: 'WhatsApp via Twilio API' },
  { id: 'meta', name: 'Meta Business API', desc: 'Official WhatsApp Business API' },
];

const PAPER_SIZES = ['A4', 'A3', 'A5', 'Letter', 'Legal', 'Tabloid', 'Custom'];
const DPI_OPTIONS = [75, 150, 200, 300, 600, 1200];
const COLOR_MODES = [
  { id: 'color', label: 'Color' },
  { id: 'grayscale', label: 'Grayscale' },
  { id: 'blackwhite', label: 'Black & White' },
];
const FILE_FORMATS = ['pdf', 'jpg', 'png'];

// ── Schema ───────────────────────────────────────────────────────────────────

const settingsSchema = z.object({
  // Transport
  smtpUser: z.string().optional(),
  // Email provider
  emailProvider: z.string().default('resend'),
  emailProviderApiKey: z.string().optional(),
  emailProviderDomain: z.string().optional(),
  // SMS
  smsEnabled: z.boolean().default(false),
  smsProvider: z.string().optional(),
  smsProviderApiKey: z.string().optional(),
  smsProviderSecret: z.string().optional(),
  smsProviderFrom: z.string().optional(),
  // WhatsApp
  whatsappEnabled: z.boolean().default(false),
  whatsappProvider: z.string().optional(),
  whatsappProviderApiKey: z.string().optional(),
  whatsappProviderFrom: z.string().optional(),
  // Channels
  defaultNotificationChannel: z.string().default('email'),
  // Limits
  maxRecipients: z.coerce.number().min(1).max(10),
  maxFileSizeMb: z.coerce.number().min(1).max(50),
  // Retention
  retentionDays: z.coerce.number().min(0).max(3650),
  // Scanner
  scannerName: z.string().optional(),
  scannerPaperSize: z.string().default('A4'),
  scannerResolutionDpi: z.coerce.number().default(300),
  scannerColorMode: z.string().default('color'),
  scannerFileFormat: z.string().default('pdf'),
  scannerDuplex: z.boolean().default(false),
  scannerBrightness: z.coerce.number().min(-100).max(100).default(0),
  scannerContrast: z.coerce.number().min(-100).max(100).default(0),
});

type SettingsForm = z.infer<typeof settingsSchema>;

// ── Helpers ──────────────────────────────────────────────────────────────────

function MaskedInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="font-mono bg-background pr-10"
      />
      <button type="button" onClick={() => setShow(s => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

function SelectButtons({ options, value, onChange }: {
  options: { id: string; label?: string; name?: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o.id} type="button" onClick={() => onChange(o.id)}
          className={cn(
            'px-3 py-1.5 rounded-lg text-sm font-medium border transition-all',
            value === o.id
              ? 'bg-primary text-primary-foreground border-primary shadow-sm'
              : 'bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
          )}>
          {o.label ?? o.name}
        </button>
      ))}
    </div>
  );
}

// ── Scan-to-URL card ─────────────────────────────────────────────────────────

function ScanToUrlCard() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const { toast } = useToast();

  const endpointUrl = `${window.location.origin}${import.meta.env.BASE_URL}api/scanner/receive`;

  const fetchKey = async () => {
    try {
      const token = localStorage.getItem('docscan_token');
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/scanner/key`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) { const d = await res.json(); setApiKey(d.scannerApiKey); }
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchKey(); }, []);

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() =>
      toast({ title: `${label} copied`, description: 'Paste it into your scanner configuration.' })
    );
  };

  const regen = async () => {
    setRegenerating(true);
    try {
      const token = localStorage.getItem('docscan_token');
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/scanner/regen-key`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) { const d = await res.json(); setApiKey(d.scannerApiKey); toast({ title: 'Key regenerated', description: 'Update your scanner with the new key.' }); }
    } catch {}
    setRegenerating(false);
  };

  return (
    <Card className="shadow-sm border-primary/20">
      <CardHeader className="bg-primary/5 border-b border-primary/10 pb-4 pt-5">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Wifi className="w-4 h-4 text-primary" /> Scan-to-URL Integration
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-5">
        <p className="text-sm text-muted-foreground">
          Configure your physical scanner to POST scanned documents directly to this endpoint.
          Supported by Fujitsu, Canon, Ricoh, Kyocera, HP, and most enterprise scanners via <strong>Scan to URL</strong> or <strong>Scan to HTTP</strong>.
        </p>

        {/* Endpoint URL */}
        <div>
          <p className="text-xs uppercase font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
            <Link className="w-3.5 h-3.5" /> Endpoint URL
          </p>
          <div className="flex gap-2">
            <code className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground truncate">
              {endpointUrl}
            </code>
            <Button type="button" variant="outline" size="icon" onClick={() => copy(endpointUrl, 'Endpoint URL')}>
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* API Key */}
        <div>
          <p className="text-xs uppercase font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5" /> Scanner API Key
          </p>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
          ) : (
            <div className="flex gap-2">
              <code className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground truncate">
                {showKey ? apiKey : '•'.repeat(Math.min(apiKey?.length ?? 0, 40))}
              </code>
              <Button type="button" variant="outline" size="icon" onClick={() => setShowKey(s => !s)}>
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
              <Button type="button" variant="outline" size="icon" onClick={() => copy(apiKey ?? '', 'API Key')}>
                <Copy className="w-4 h-4" />
              </Button>
              <Button type="button" variant="outline" size="icon" onClick={regen} disabled={regenerating}>
                <RotateCcw className={cn('w-4 h-4', regenerating && 'animate-spin')} />
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-1.5">Use this key as: HTTP header <code className="bg-muted px-1 rounded">X-Scanner-Key: &lt;key&gt;</code> or query param <code className="bg-muted px-1 rounded">?key=&lt;key&gt;</code></p>
        </div>

        {/* Setup guide */}
        <div className="bg-muted/40 rounded-lg p-4 border border-border space-y-2">
          <p className="text-xs uppercase font-semibold text-muted-foreground">Quick Setup Guide</p>
          <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal pl-4">
            <li>On your scanner, find <strong>Scan to URL</strong>, <strong>Scan to HTTP</strong>, or <strong>Network Folder/FTP</strong> settings.</li>
            <li>Set the destination URL to the endpoint above.</li>
            <li>Add a custom HTTP header <code className="bg-muted px-1 rounded font-mono text-xs">X-Scanner-Key</code> with the API key value.</li>
            <li>Set output format to <strong>PDF</strong>, <strong>JPEG</strong>, or <strong>PNG</strong>.</li>
            <li>Scan a document — it will appear on the <strong>Scan & Dispatch</strong> page instantly.</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Settings() {
  const { data: settings, isLoading } = useGetSettings();
  const updateSettings = useUpdateSettings();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [testEmail, setTestEmail] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const form = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      smtpUser: '',
      emailProvider: 'resend',
      emailProviderApiKey: '',
      emailProviderDomain: '',
      smsEnabled: false,
      smsProvider: 'twilio',
      smsProviderApiKey: '',
      smsProviderSecret: '',
      smsProviderFrom: '',
      whatsappEnabled: false,
      whatsappProvider: 'twilio',
      whatsappProviderApiKey: '',
      whatsappProviderFrom: '',
      defaultNotificationChannel: 'email',
      maxRecipients: 5,
      maxFileSizeMb: 10,
      retentionDays: 30,
      scannerName: '',
      scannerPaperSize: 'A4',
      scannerResolutionDpi: 300,
      scannerColorMode: 'color',
      scannerFileFormat: 'pdf',
      scannerDuplex: false,
      scannerBrightness: 0,
      scannerContrast: 0,
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        smtpUser: settings.smtpUser || '',
        emailProvider: settings.emailProvider || 'resend',
        emailProviderApiKey: settings.emailProviderApiKey || '',
        emailProviderDomain: settings.emailProviderDomain || '',
        smsEnabled: settings.smsEnabled ?? false,
        smsProvider: settings.smsProvider || 'twilio',
        smsProviderApiKey: settings.smsProviderApiKey || '',
        smsProviderSecret: settings.smsProviderSecret || '',
        smsProviderFrom: settings.smsProviderFrom || '',
        whatsappEnabled: settings.whatsappEnabled ?? false,
        whatsappProvider: settings.whatsappProvider || 'twilio',
        whatsappProviderApiKey: settings.whatsappProviderApiKey || '',
        whatsappProviderFrom: settings.whatsappProviderFrom || '',
        defaultNotificationChannel: settings.defaultNotificationChannel || 'email',
        maxRecipients: settings.maxRecipients,
        maxFileSizeMb: settings.maxFileSizeMb,
        retentionDays: settings.retentionDays ?? 30,
        scannerName: settings.scannerName || '',
        scannerPaperSize: settings.scannerPaperSize || 'A4',
        scannerResolutionDpi: settings.scannerResolutionDpi ?? 300,
        scannerColorMode: settings.scannerColorMode || 'color',
        scannerFileFormat: settings.scannerFileFormat || 'pdf',
        scannerDuplex: settings.scannerDuplex ?? false,
        scannerBrightness: settings.scannerBrightness ?? 0,
        scannerContrast: settings.scannerContrast ?? 0,
      });
    }
  }, [settings, form]);

  const onSubmit = (values: SettingsForm) => {
    updateSettings.mutate({ data: values as any }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
        toast({ title: 'Settings Saved', description: 'All configuration has been updated.' });
      },
      onError: (err) => {
        toast({ title: 'Save Failed', description: (err as any).data?.error || 'Error saving settings.', variant: 'destructive' });
      },
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
      setTestResult({ success: false, message: 'Network error during dispatch' });
    } finally {
      setTestSending(false);
    }
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />Loading settings…</div>;

  const emailProvider = form.watch('emailProvider');
  const smsEnabled = form.watch('smsEnabled');
  const whatsappEnabled = form.watch('whatsappEnabled');
  const retentionDays = form.watch('retentionDays');
  const scannerDuplex = form.watch('scannerDuplex');

  return (
    <div className="max-w-4xl mx-auto pb-16">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Configure system behaviour, providers, retention, and scanner options.</p>
      </div>

      {/* Status bar */}
      <div className="bg-card border border-border rounded-lg p-4 flex items-center gap-4 shadow-sm mb-6">
        <div className="bg-primary/10 p-2 rounded shrink-0">
          <Server className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-foreground">API Transport Active</span>
            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-0 text-[10px] uppercase tracking-widest font-bold">Connected</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Outbound traffic routed via Resend API. Changes take effect immediately.</p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => { queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() }); }}>
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
        </Button>
      </div>

      {!settings?.smtpUser && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 flex items-start gap-3 mb-6">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-800 text-sm">From address not configured — emails only reach your Resend account</p>
            <p className="text-amber-700 text-xs mt-1">Set a verified sender address below (e.g. <code className="bg-amber-100 px-1 rounded">noreply@yourdomain.com</code>) to send to all recipients.</p>
          </div>
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <Tabs defaultValue="email" className="space-y-6">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="email" className="gap-1.5"><Mail className="w-3.5 h-3.5" /> Email</TabsTrigger>
              <TabsTrigger value="notifications" className="gap-1.5"><MessageSquare className="w-3.5 h-3.5" /> Notifications</TabsTrigger>
              <TabsTrigger value="storage" className="gap-1.5"><Clock className="w-3.5 h-3.5" /> Storage</TabsTrigger>
              <TabsTrigger value="scanner" className="gap-1.5"><Printer className="w-3.5 h-3.5" /> Scanner</TabsTrigger>
            </TabsList>

            {/* ── EMAIL TAB ────────────────────────────────────────────── */}
            <TabsContent value="email" className="space-y-6 mt-0">

              {/* From address */}
              <Card className="shadow-sm">
                <CardHeader className="bg-muted/30 border-b border-border pb-4 pt-5">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-muted-foreground" /> Sender Identity
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <FormField control={form.control} name="smtpUser" render={({ field }) => (
                    <FormItem className="max-w-md">
                      <FormLabel className="text-xs uppercase font-semibold text-muted-foreground">From Address</FormLabel>
                      <FormControl>
                        <Input placeholder="noreply@domain.com" className="font-mono bg-background" {...field} />
                      </FormControl>
                      <FormDescription className="text-xs">Must be verified with your email provider. Defaults to <code className="bg-muted px-1 py-0.5 rounded text-foreground">onboarding@resend.dev</code></FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                </CardContent>
              </Card>

              {/* Email provider selection */}
              <Card className="shadow-sm">
                <CardHeader className="bg-muted/30 border-b border-border pb-4 pt-5">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Zap className="w-4 h-4 text-muted-foreground" /> Email Service Provider
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-5">
                  <FormField control={form.control} name="emailProvider" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs uppercase font-semibold text-muted-foreground">Provider</FormLabel>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                        {EMAIL_PROVIDERS.map((p) => (
                          <button key={p.id} type="button" onClick={() => field.onChange(p.id)}
                            className={cn(
                              'flex flex-col items-start p-3 rounded-lg border text-left transition-all',
                              field.value === p.id
                                ? 'border-primary bg-primary/5 shadow-sm'
                                : 'border-border hover:border-primary/40 bg-background',
                            )}>
                            <div className="flex items-center justify-between w-full mb-1">
                              <span className="font-semibold text-sm text-foreground">{p.name}</span>
                              {field.value === p.id && (
                                <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                                  <CheckCircle2 className="w-3 h-3 text-primary-foreground" />
                                </div>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">{p.desc}</span>
                          </button>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )} />

                  {/* Provider-specific fields */}
                  {emailProvider !== 'smtp' && (
                    <FormField control={form.control} name="emailProviderApiKey" render={({ field }) => (
                      <FormItem className="max-w-md">
                        <FormLabel className="text-xs uppercase font-semibold text-muted-foreground">API Key</FormLabel>
                        <FormControl>
                          <MaskedInput value={field.value ?? ''} onChange={field.onChange} placeholder={`${EMAIL_PROVIDERS.find(p => p.id === emailProvider)?.name ?? 'Provider'} API key`} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}

                  {(emailProvider === 'mailgun' || emailProvider === 'ses') && (
                    <FormField control={form.control} name="emailProviderDomain" render={({ field }) => (
                      <FormItem className="max-w-md">
                        <FormLabel className="text-xs uppercase font-semibold text-muted-foreground">
                          {emailProvider === 'ses' ? 'AWS Region' : 'Mailgun Domain'}
                        </FormLabel>
                        <FormControl>
                          <Input placeholder={emailProvider === 'ses' ? 'us-east-1' : 'mg.yourdomain.com'} className="font-mono bg-background" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}

                  {emailProvider === 'smtp' && (
                    <div className="grid sm:grid-cols-2 gap-4 max-w-xl">
                      <FormField control={form.control} name="smtpUser" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs uppercase font-semibold text-muted-foreground">SMTP Username</FormLabel>
                          <FormControl><Input placeholder="user@domain.com" className="font-mono bg-background" {...field} /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="emailProviderApiKey" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs uppercase font-semibold text-muted-foreground">SMTP Password</FormLabel>
                          <FormControl>
                            <MaskedInput value={field.value ?? ''} onChange={field.onChange} placeholder="password" />
                          </FormControl>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="emailProviderDomain" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs uppercase font-semibold text-muted-foreground">SMTP Host</FormLabel>
                          <FormControl><Input placeholder="smtp.domain.com" className="font-mono bg-background" {...field} /></FormControl>
                        </FormItem>
                      )} />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Test email */}
              <Card className="shadow-sm">
                <CardHeader className="bg-muted/30 border-b border-border pb-4 pt-5">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" /> Diagnostic Send
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="flex gap-3 max-w-md">
                    <Input
                      type="email"
                      placeholder="recipient@example.com"
                      value={testEmail}
                      onChange={(e) => { setTestEmail(e.target.value); setTestResult(null); }}
                      className="bg-background"
                    />
                    <Button type="button" variant="outline" onClick={handleTestEmail} disabled={testSending || !testEmail}>
                      {testSending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Test'}
                    </Button>
                  </div>
                  {testResult && (
                    <div className={cn('mt-3 flex items-start gap-2 text-sm p-3 rounded-lg border', testResult.success ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800')}>
                      {testResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                      {testResult.message}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── NOTIFICATIONS TAB ────────────────────────────────────── */}
            <TabsContent value="notifications" className="space-y-6 mt-0">

              {/* Channel toggles */}
              <Card className="shadow-sm">
                <CardHeader className="bg-muted/30 border-b border-border pb-4 pt-5">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Zap className="w-4 h-4 text-muted-foreground" /> Active Channels
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <p className="text-sm text-muted-foreground">Choose which channels are used for dispatch notifications. Email is always available.</p>

                  {/* Email — always on */}
                  <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-background">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Mail className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">Email</p>
                        <p className="text-xs text-muted-foreground">Routed via configured email provider</p>
                      </div>
                    </div>
                    <Badge className="bg-green-100 text-green-800 border-green-200 text-[10px] uppercase font-bold">Always Active</Badge>
                  </div>

                  {/* SMS */}
                  <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-background">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <Phone className="w-4 h-4 text-blue-500" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">SMS</p>
                        <p className="text-xs text-muted-foreground">Text message notifications via SMS provider</p>
                      </div>
                    </div>
                    <FormField control={form.control} name="smsEnabled" render={({ field }) => (
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    )} />
                  </div>

                  {/* WhatsApp */}
                  <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-background">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center">
                        <MessageSquare className="w-4 h-4 text-green-500" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">WhatsApp</p>
                        <p className="text-xs text-muted-foreground">WhatsApp message notifications</p>
                      </div>
                    </div>
                    <FormField control={form.control} name="whatsappEnabled" render={({ field }) => (
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    )} />
                  </div>

                  {/* Default channel */}
                  <FormField control={form.control} name="defaultNotificationChannel" render={({ field }) => (
                    <FormItem className="pt-2">
                      <FormLabel className="text-xs uppercase font-semibold text-muted-foreground">Default Channel</FormLabel>
                      <FormDescription className="text-xs mb-2">Used when the recipient has no channel preference.</FormDescription>
                      <SelectButtons
                        value={field.value}
                        onChange={field.onChange}
                        options={[
                          { id: 'email', label: 'Email' },
                          ...(smsEnabled ? [{ id: 'sms', label: 'SMS' }] : []),
                          ...(whatsappEnabled ? [{ id: 'whatsapp', label: 'WhatsApp' }] : []),
                        ]}
                      />
                    </FormItem>
                  )} />
                </CardContent>
              </Card>

              {/* SMS Provider config */}
              {smsEnabled && (
                <Card className="shadow-sm border-blue-200">
                  <CardHeader className="bg-blue-50/50 border-b border-blue-100 pb-4 pt-5">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Phone className="w-4 h-4 text-blue-500" /> SMS Provider Configuration
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-5">
                    <FormField control={form.control} name="smsProvider" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs uppercase font-semibold text-muted-foreground">Provider</FormLabel>
                        <div className="grid grid-cols-3 gap-2 mt-2">
                          {SMS_PROVIDERS.map((p) => (
                            <button key={p.id} type="button" onClick={() => field.onChange(p.id)}
                              className={cn(
                                'flex flex-col items-start p-3 rounded-lg border text-left transition-all',
                                field.value === p.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40 bg-background',
                              )}>
                              <span className="font-semibold text-sm text-foreground">{p.name}</span>
                              <span className="text-xs text-muted-foreground mt-0.5">{p.desc}</span>
                            </button>
                          ))}
                        </div>
                      </FormItem>
                    )} />

                    <div className="grid sm:grid-cols-2 gap-4">
                      <FormField control={form.control} name="smsProviderApiKey" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs uppercase font-semibold text-muted-foreground">Account SID / API Key</FormLabel>
                          <FormControl><MaskedInput value={field.value ?? ''} onChange={field.onChange} placeholder="API key or SID" /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="smsProviderSecret" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs uppercase font-semibold text-muted-foreground">Auth Token / Secret</FormLabel>
                          <FormControl><MaskedInput value={field.value ?? ''} onChange={field.onChange} placeholder="Auth token or secret" /></FormControl>
                        </FormItem>
                      )} />
                    </div>
                    <FormField control={form.control} name="smsProviderFrom" render={({ field }) => (
                      <FormItem className="max-w-xs">
                        <FormLabel className="text-xs uppercase font-semibold text-muted-foreground">From Number</FormLabel>
                        <FormControl><Input placeholder="+15551234567" className="font-mono bg-background" {...field} /></FormControl>
                        <FormDescription className="text-xs">E.164 format (e.g. +15551234567)</FormDescription>
                      </FormItem>
                    )} />
                  </CardContent>
                </Card>
              )}

              {/* WhatsApp Provider config */}
              {whatsappEnabled && (
                <Card className="shadow-sm border-green-200">
                  <CardHeader className="bg-green-50/50 border-b border-green-100 pb-4 pt-5">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-green-500" /> WhatsApp Provider Configuration
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-5">
                    <FormField control={form.control} name="whatsappProvider" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs uppercase font-semibold text-muted-foreground">Provider</FormLabel>
                        <div className="grid sm:grid-cols-2 gap-2 mt-2">
                          {WHATSAPP_PROVIDERS.map((p) => (
                            <button key={p.id} type="button" onClick={() => field.onChange(p.id)}
                              className={cn(
                                'flex flex-col items-start p-3 rounded-lg border text-left transition-all',
                                field.value === p.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40 bg-background',
                              )}>
                              <span className="font-semibold text-sm text-foreground">{p.name}</span>
                              <span className="text-xs text-muted-foreground mt-0.5">{p.desc}</span>
                            </button>
                          ))}
                        </div>
                      </FormItem>
                    )} />
                    <div className="grid sm:grid-cols-2 gap-4">
                      <FormField control={form.control} name="whatsappProviderApiKey" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs uppercase font-semibold text-muted-foreground">API Key / Token</FormLabel>
                          <FormControl><MaskedInput value={field.value ?? ''} onChange={field.onChange} placeholder="API key or token" /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="whatsappProviderFrom" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs uppercase font-semibold text-muted-foreground">From Number / ID</FormLabel>
                          <FormControl><Input placeholder="+15551234567" className="font-mono bg-background" {...field} /></FormControl>
                        </FormItem>
                      )} />
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* ── STORAGE TAB ──────────────────────────────────────────── */}
            <TabsContent value="storage" className="space-y-6 mt-0">

              {/* Retention policy */}
              <Card className="shadow-sm">
                <CardHeader className="bg-muted/30 border-b border-border pb-4 pt-5">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" /> Document Retention Policy
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-5">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-semibold text-amber-800">Permanent deletion</p>
                      <p className="text-amber-700 mt-0.5">Documents older than the retention period are permanently deleted from the server and database. This cannot be undone.</p>
                    </div>
                  </div>

                  <FormField control={form.control} name="retentionDays" render={({ field }) => (
                    <FormItem className="max-w-xs">
                      <FormLabel className="text-xs uppercase font-semibold text-muted-foreground">Retention Period (days)</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} max={3650} className="font-mono bg-background" {...field} />
                      </FormControl>
                      <FormDescription className="text-xs">
                        Set to <strong>0</strong> to disable automatic deletion. Max 3650 days (10 years).
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />

                  {/* Quick presets */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-2 uppercase font-semibold tracking-wider">Quick Presets</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { label: 'Disabled', days: 0 },
                        { label: '7 days', days: 7 },
                        { label: '30 days', days: 30 },
                        { label: '90 days', days: 90 },
                        { label: '1 year', days: 365 },
                        { label: '7 years', days: 2555 },
                      ].map((p) => (
                        <button key={p.days} type="button"
                          onClick={() => form.setValue('retentionDays', p.days)}
                          className={cn(
                            'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                            retentionDays === p.days
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-background border-border text-muted-foreground hover:border-primary/50',
                          )}>
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="bg-muted/40 rounded-lg p-4 border border-border">
                    <div className="flex items-center gap-2 text-sm">
                      {retentionDays === 0 ? (
                        <>
                          <div className="w-2 h-2 rounded-full bg-green-500" />
                          <span className="font-medium text-foreground">Automatic deletion disabled — documents are kept indefinitely.</span>
                        </>
                      ) : (
                        <>
                          <div className="w-2 h-2 rounded-full bg-amber-500" />
                          <span className="font-medium text-foreground">Documents older than <strong>{retentionDays} day{retentionDays !== 1 ? 's' : ''}</strong> will be automatically and permanently deleted every 6 hours.</span>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Limits */}
              <Card className="shadow-sm">
                <CardHeader className="bg-muted/30 border-b border-border pb-4 pt-5">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-muted-foreground" /> Upload Constraints
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 grid sm:grid-cols-2 gap-8">
                  <FormField control={form.control} name="maxFileSizeMb" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs uppercase font-semibold text-muted-foreground">Max File Size (MB)</FormLabel>
                      <FormControl><Input type="number" className="font-mono bg-background" {...field} /></FormControl>
                      <FormDescription className="text-xs">Hard limit per upload.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="maxRecipients" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs uppercase font-semibold text-muted-foreground">Max Recipients</FormLabel>
                      <FormControl><Input type="number" className="font-mono bg-background" {...field} /></FormControl>
                      <FormDescription className="text-xs">Max mailroom targets per dispatch.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                </CardContent>
              </Card>

              {/* File types */}
              <Card className="shadow-sm">
                <CardHeader className="bg-muted/30 border-b border-border pb-4 pt-5">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <FileType className="w-4 h-4 text-muted-foreground" /> Accepted File Types
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-5">
                  <div className="flex flex-wrap gap-2 mb-3">
                    {(settings?.allowedFileTypes ?? 'pdf,jpg,jpeg,png').split(',').map((ext) => (
                      <span key={ext} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase border border-primary/20">
                        .{ext.trim()}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">Configured in the database. Contact your system administrator to change accepted types.</p>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── SCANNER TAB ──────────────────────────────────────────── */}
            <TabsContent value="scanner" className="space-y-6 mt-0">

              {/* Scan-to-URL integration */}
              <ScanToUrlCard />

              {/* Scanner identity */}
              <Card className="shadow-sm">
                <CardHeader className="bg-muted/30 border-b border-border pb-4 pt-5">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Printer className="w-4 h-4 text-muted-foreground" /> Scanner Device
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <FormField control={form.control} name="scannerName" render={({ field }) => (
                    <FormItem className="max-w-md">
                      <FormLabel className="text-xs uppercase font-semibold text-muted-foreground">Scanner Name / Model</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Fujitsu fi-7160, HP ScanJet Pro 3600" className="bg-background" {...field} />
                      </FormControl>
                      <FormDescription className="text-xs">Display label for the active scanner device.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                </CardContent>
              </Card>

              {/* Page & format */}
              <Card className="shadow-sm">
                <CardHeader className="bg-muted/30 border-b border-border pb-4 pt-5">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <ScanLine className="w-4 h-4 text-muted-foreground" /> Page & Format Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  {/* Paper size */}
                  <FormField control={form.control} name="scannerPaperSize" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs uppercase font-semibold text-muted-foreground">Paper Size</FormLabel>
                      <SelectButtons value={field.value} onChange={field.onChange}
                        options={PAPER_SIZES.map(s => ({ id: s, label: s }))} />
                      <FormMessage />
                    </FormItem>
                  )} />

                  {/* Resolution */}
                  <FormField control={form.control} name="scannerResolutionDpi" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs uppercase font-semibold text-muted-foreground">Resolution (DPI)</FormLabel>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {DPI_OPTIONS.map((dpi) => (
                          <button key={dpi} type="button" onClick={() => field.onChange(dpi)}
                            className={cn(
                              'px-3 py-1.5 rounded-lg text-sm font-medium border transition-all font-mono',
                              field.value === dpi
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-background border-border text-muted-foreground hover:border-primary/50',
                            )}>
                            {dpi}
                          </button>
                        ))}
                        <Input
                          type="number"
                          value={field.value}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                          className="w-24 font-mono bg-background h-9"
                          placeholder="Custom"
                        />
                      </div>
                      <FormDescription className="text-xs mt-1">Higher DPI = better quality, larger files. 300 DPI recommended for documents.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />

                  {/* File format */}
                  <FormField control={form.control} name="scannerFileFormat" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs uppercase font-semibold text-muted-foreground">Output Format</FormLabel>
                      <SelectButtons value={field.value} onChange={field.onChange}
                        options={FILE_FORMATS.map(f => ({ id: f, label: f.toUpperCase() }))} />
                      <FormDescription className="text-xs mt-1">PDF preserves multi-page layout. JPG/PNG produce single image files.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                </CardContent>
              </Card>

              {/* Image settings */}
              <Card className="shadow-sm">
                <CardHeader className="bg-muted/30 border-b border-border pb-4 pt-5">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Camera className="w-4 h-4 text-muted-foreground" /> Image Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  {/* Color mode */}
                  <FormField control={form.control} name="scannerColorMode" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs uppercase font-semibold text-muted-foreground">Color Mode</FormLabel>
                      <SelectButtons value={field.value} onChange={field.onChange}
                        options={COLOR_MODES.map(c => ({ id: c.id, label: c.label }))} />
                      <FormMessage />
                    </FormItem>
                  )} />

                  {/* Duplex */}
                  <FormField control={form.control} name="scannerDuplex" render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-background max-w-sm">
                        <div>
                          <FormLabel className="font-semibold text-sm text-foreground cursor-pointer">Duplex Scanning</FormLabel>
                          <p className="text-xs text-muted-foreground mt-0.5">Scan both sides of the page automatically</p>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </div>
                      {scannerDuplex && (
                        <p className="text-xs text-primary mt-1 font-medium">✓ Duplex mode enabled — both sides will be scanned per sheet</p>
                      )}
                    </FormItem>
                  )} />

                  {/* Brightness */}
                  <FormField control={form.control} name="scannerBrightness" render={({ field }) => (
                    <FormItem className="max-w-xs">
                      <div className="flex items-center justify-between">
                        <FormLabel className="text-xs uppercase font-semibold text-muted-foreground">Brightness</FormLabel>
                        <span className="text-xs font-mono text-foreground bg-muted px-2 py-0.5 rounded">
                          {field.value > 0 ? `+${field.value}` : field.value}
                        </span>
                      </div>
                      <input
                        type="range" min={-100} max={100} step={5}
                        value={field.value}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                        className="w-full accent-primary"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Darker</span><span>Default (0)</span><span>Brighter</span>
                      </div>
                    </FormItem>
                  )} />

                  {/* Contrast */}
                  <FormField control={form.control} name="scannerContrast" render={({ field }) => (
                    <FormItem className="max-w-xs">
                      <div className="flex items-center justify-between">
                        <FormLabel className="text-xs uppercase font-semibold text-muted-foreground">Contrast</FormLabel>
                        <span className="text-xs font-mono text-foreground bg-muted px-2 py-0.5 rounded">
                          {field.value > 0 ? `+${field.value}` : field.value}
                        </span>
                      </div>
                      <input
                        type="range" min={-100} max={100} step={5}
                        value={field.value}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                        className="w-full accent-primary"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Lower</span><span>Default (0)</span><span>Higher</span>
                      </div>
                    </FormItem>
                  )} />
                </CardContent>
              </Card>

              {/* Scan summary */}
              <Card className="shadow-sm bg-muted/20">
                <CardContent className="pt-5 pb-5">
                  <p className="text-xs uppercase font-semibold text-muted-foreground mb-3">Current Scanner Configuration</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                    {[
                      { label: 'Paper size', value: form.watch('scannerPaperSize') },
                      { label: 'Resolution', value: `${form.watch('scannerResolutionDpi')} DPI` },
                      { label: 'Color mode', value: COLOR_MODES.find(c => c.id === form.watch('scannerColorMode'))?.label ?? '-' },
                      { label: 'Format', value: (form.watch('scannerFileFormat') ?? 'pdf').toUpperCase() },
                      { label: 'Duplex', value: form.watch('scannerDuplex') ? 'On' : 'Off' },
                      { label: 'Brightness', value: form.watch('scannerBrightness') > 0 ? `+${form.watch('scannerBrightness')}` : String(form.watch('scannerBrightness')) },
                      { label: 'Contrast', value: form.watch('scannerContrast') > 0 ? `+${form.watch('scannerContrast')}` : String(form.watch('scannerContrast')) },
                      { label: 'Scanner', value: form.watch('scannerName') || 'Not set' },
                    ].map((item) => (
                      <div key={item.label}>
                        <p className="text-muted-foreground text-xs">{item.label}</p>
                        <p className="font-bold text-foreground font-mono text-sm">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Save button — always visible */}
          <div className="fixed bottom-6 right-6 z-50">
            <Button type="submit" disabled={updateSettings.isPending} size="lg" className="shadow-lg shadow-primary/20 gap-2">
              {updateSettings.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Settings
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
