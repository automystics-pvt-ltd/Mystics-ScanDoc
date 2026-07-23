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
import { getApiUrl } from '@/lib/api';
import { cn } from '@/lib/utils';

// ── Constants ────────────────────────────────────────────────────────────────

const EMAIL_PROVIDERS = [
  { id: 'resend',    name: 'Resend',       desc: 'Transactional email API' },
  { id: 'sendgrid',  name: 'SendGrid',     desc: 'Twilio SendGrid' },
  { id: 'mailgun',   name: 'Mailgun',      desc: 'Mailgun email API' },
  { id: 'ses',       name: 'AWS SES',      desc: 'Amazon Simple Email Service' },
  { id: 'postmark',  name: 'Postmark',     desc: 'Postmark transactional email' },
  { id: 'smtp',      name: 'Custom SMTP',  desc: 'Any SMTP server' },
];

const SMS_PROVIDERS = [
  { id: 'twilio',      name: 'Twilio',       desc: 'Industry-leading SMS API' },
  { id: 'vonage',      name: 'Vonage',       desc: 'Vonage SMS (formerly Nexmo)' },
  { id: 'messagebird', name: 'MessageBird',  desc: 'MessageBird SMS' },
];

const WHATSAPP_PROVIDERS = [
  { id: 'twilio', name: 'Twilio WhatsApp',   desc: 'WhatsApp via Twilio API' },
  { id: 'meta',   name: 'Meta Business API', desc: 'Official WhatsApp Business API' },
];

const PAPER_SIZES = ['A4', 'A3', 'A5', 'Letter', 'Legal', 'Tabloid', 'Custom'];
const DPI_OPTIONS = [75, 150, 200, 300, 600, 1200];
const COLOR_MODES = [
  { id: 'color',      label: 'Color' },
  { id: 'grayscale',  label: 'Grayscale' },
  { id: 'blackwhite', label: 'Black & White' },
];
const FILE_FORMATS = ['pdf', 'jpg', 'png'];

// ── Schema ───────────────────────────────────────────────────────────────────

const settingsSchema = z.object({
  smtpUser: z.string().optional(),
  emailProvider: z.string().default('resend'),
  emailProviderApiKey: z.string().optional(),
  emailProviderDomain: z.string().optional(),
  smsEnabled: z.boolean().default(false),
  smsProvider: z.string().optional(),
  smsProviderApiKey: z.string().optional(),
  smsProviderSecret: z.string().optional(),
  smsProviderFrom: z.string().optional(),
  whatsappEnabled: z.boolean().default(false),
  whatsappProvider: z.string().optional(),
  whatsappProviderApiKey: z.string().optional(),
  whatsappProviderFrom: z.string().optional(),
  defaultNotificationChannel: z.string().default('email'),
  maxRecipients: z.coerce.number().min(1).max(10),
  maxFileSizeMb: z.coerce.number().min(1).max(50),
  retentionDays: z.coerce.number().min(0).max(3650),
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
type Section = 'email' | 'notifications' | 'storage' | 'scanner';

// ── Micro helpers ─────────────────────────────────────────────────────────────

function FieldRow({ label, hint, children, className }: {
  label: string; hint?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-8 py-3.5 border-b border-border/60 last:border-0', className)}>
      <div className="min-w-0 flex-shrink-0 w-52">
        <p className="text-sm font-medium text-foreground leading-snug">{label}</p>
        {hint && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{hint}</p>}
      </div>
      <div className="flex-1 max-w-sm">{children}</div>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground pt-5 pb-1 first:pt-0">
      {children}
    </p>
  );
}

function MaskedInput({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} className="font-mono text-sm pr-9 h-8" />
      <button type="button" onClick={() => setShow(s => !s)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
        {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

function ProviderList({ options, value, onChange }: {
  options: { id: string; name: string; desc: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="divide-y divide-border/60 rounded border border-border overflow-hidden">
      {options.map((o) => (
        <button key={o.id} type="button" onClick={() => onChange(o.id)}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors text-sm',
            value === o.id ? 'bg-primary/5' : 'bg-background hover:bg-muted/40',
          )}>
          <span className={cn(
            'w-3.5 h-3.5 rounded-full border-2 shrink-0 transition-colors',
            value === o.id ? 'border-primary bg-primary' : 'border-muted-foreground/40',
          )} />
          <span className="font-medium text-foreground">{o.name}</span>
          <span className="text-xs text-muted-foreground ml-auto">{o.desc}</span>
        </button>
      ))}
    </div>
  );
}

function ChipGroup({ options, value, onChange }: {
  options: { id: string; label: string }[];
  value: string | number;
  onChange: (v: any) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button key={o.id} type="button" onClick={() => onChange(o.id)}
          className={cn(
            'px-2.5 py-1 rounded text-xs font-medium border transition-all',
            String(value) === String(o.id)
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
          )}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── Scan-to-URL card ──────────────────────────────────────────────────────────

function ScanToUrlSection() {
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
      toast({ title: `${label} copied` })
    );
  };

  const regen = async () => {
    setRegenerating(true);
    try {
      const token = localStorage.getItem('docscan_token');
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/scanner/regen-key`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d = await res.json(); setApiKey(d.scannerApiKey);
        toast({ title: 'Key regenerated', description: 'Update your scanner configuration.' });
      }
    } catch {}
    setRegenerating(false);
  };

  return (
    <>
      <SectionHeading>Scan-to-URL</SectionHeading>
      <div className="divide-y divide-border/60 border-b border-border/60">
        <FieldRow label="Endpoint URL" hint="POST scanned documents to this address">
          <div className="flex gap-1.5">
            <code className="flex-1 bg-muted border border-border rounded px-2.5 py-1.5 text-xs font-mono text-foreground truncate block">
              {endpointUrl}
            </code>
            <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => copy(endpointUrl, 'Endpoint URL')}>
              <Copy className="w-3.5 h-3.5" />
            </Button>
          </div>
        </FieldRow>

        <FieldRow label="API Key" hint={`Header: X-Scanner-Key or ?key= query param`}>
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground h-8">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
            </div>
          ) : (
            <div className="flex gap-1.5">
              <code className="flex-1 bg-muted border border-border rounded px-2.5 py-1.5 text-xs font-mono text-foreground truncate block">
                {showKey ? apiKey : '•'.repeat(Math.min(apiKey?.length ?? 0, 36))}
              </code>
              <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => setShowKey(s => !s)}>
                {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </Button>
              <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => copy(apiKey ?? '', 'API Key')}>
                <Copy className="w-3.5 h-3.5" />
              </Button>
              <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={regen} disabled={regenerating}>
                <RotateCcw className={cn('w-3.5 h-3.5', regenerating && 'animate-spin')} />
              </Button>
            </div>
          )}
        </FieldRow>

        <FieldRow label="Setup steps" hint="Compatible with Fujitsu, Canon, Ricoh, Kyocera, HP">
          <ol className="text-xs text-muted-foreground space-y-1 list-decimal pl-3.5">
            <li>Open scanner web UI → Scan to URL / Scan to HTTP</li>
            <li>Set destination to the endpoint URL above</li>
            <li>Add header <code className="bg-muted px-1 rounded">X-Scanner-Key</code> with the API key</li>
            <li>Output format: PDF, JPEG, or PNG</li>
          </ol>
        </FieldRow>
      </div>
    </>
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
  const [activeSection, setActiveSection] = useState<Section>('email');

  const form = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      smtpUser: '', emailProvider: 'resend', emailProviderApiKey: '', emailProviderDomain: '',
      smsEnabled: false, smsProvider: 'twilio', smsProviderApiKey: '', smsProviderSecret: '', smsProviderFrom: '',
      whatsappEnabled: false, whatsappProvider: 'twilio', whatsappProviderApiKey: '', whatsappProviderFrom: '',
      defaultNotificationChannel: 'email', maxRecipients: 5, maxFileSizeMb: 10, retentionDays: 30,
      scannerName: '', scannerPaperSize: 'A4', scannerResolutionDpi: 300, scannerColorMode: 'color',
      scannerFileFormat: 'pdf', scannerDuplex: false, scannerBrightness: 0, scannerContrast: 0,
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
        toast({ title: 'Settings saved' });
      },
      onError: (err) => {
        toast({ title: 'Save failed', description: (err as any).data?.error || 'Error saving settings.', variant: 'destructive' });
      },
    });
  };

  const handleTestEmail = async () => {
    if (!testEmail) return;
    setTestSending(true); setTestResult(null);
    try {
      const res = await fetch(`${getApiUrl()}admin/test-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ to: testEmail }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({ success: true, message: `Dispatched. Ref: ${data.messageId}` });
      } else {
        setTestResult({ success: false, message: data.error || 'Dispatch failed' });
      }
    } catch {
      setTestResult({ success: false, message: 'Network error' });
    } finally { setTestSending(false); }
  };

  if (isLoading) return (
    <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
      <Loader2 className="w-4 h-4 animate-spin" /> Loading settings…
    </div>
  );

  const emailProvider = form.watch('emailProvider');
  const smsEnabled    = form.watch('smsEnabled');
  const whatsappEnabled = form.watch('whatsappEnabled');
  const retentionDays = form.watch('retentionDays');
  const scannerDuplex = form.watch('scannerDuplex');

  const NAV: { id: Section; label: string; icon: React.ElementType }[] = [
    { id: 'email',         label: 'Email',         icon: Mail },
    { id: 'notifications', label: 'Notifications', icon: MessageSquare },
    { id: 'storage',       label: 'Storage',       icon: Clock },
    { id: 'scanner',       label: 'Scanner',       icon: Printer },
  ];

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="h-full">
        {/* ── Page header ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
            <p className="text-xs text-muted-foreground mt-0.5">System configuration, integrations and scanner preferences</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Connection status */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground border border-border rounded px-2.5 py-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
              <span className="font-medium text-foreground">API Connected</span>
              <button type="button" onClick={() => queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() })}
                className="ml-1 hover:text-foreground transition-colors">
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>
            <Button type="submit" size="sm" disabled={updateSettings.isPending} className="gap-1.5 h-8">
              {updateSettings.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save changes
            </Button>
          </div>
        </div>

        {/* ── From-address warning ─────────────────────────────────────── */}
        {!settings?.smtpUser && (
          <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-4">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span><strong>From address not configured.</strong> Emails only reach your Resend account. Set a verified sender in the Email tab.</span>
          </div>
        )}

        {/* ── Two-column layout ────────────────────────────────────────── */}
        <div className="flex gap-0 border border-border rounded-lg overflow-hidden bg-card min-h-[600px]">

          {/* Left nav */}
          <nav className="w-44 shrink-0 border-r border-border bg-muted/20 py-3">
            {NAV.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" onClick={() => setActiveSection(id)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-4 py-2 text-sm font-medium transition-colors text-left',
                  activeSection === id
                    ? 'text-foreground bg-background border-r-2 border-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/60',
                )}>
                <Icon className="w-3.5 h-3.5 shrink-0" />
                {label}
              </button>
            ))}
          </nav>

          {/* Content */}
          <div className="flex-1 px-6 py-4 overflow-y-auto">

            {/* ══ EMAIL ══════════════════════════════════════════════════ */}
            {activeSection === 'email' && (
              <div>
                <SectionHeading>Sender Identity</SectionHeading>
                <div className="border-b border-border/60">
                  <FormField control={form.control} name="smtpUser" render={({ field }) => (
                    <FieldRow label="From address" hint={`Defaults to onboarding@resend.dev`}>
                      <Input placeholder="noreply@domain.com" className="font-mono h-8 text-sm" {...field} />
                    </FieldRow>
                  )} />
                </div>

                <SectionHeading>Email Service Provider</SectionHeading>
                <div className="border-b border-border/60">
                  <FormField control={form.control} name="emailProvider" render={({ field }) => (
                    <FieldRow label="Provider" hint="Select the outbound email service">
                      <ProviderList options={EMAIL_PROVIDERS} value={field.value} onChange={field.onChange} />
                    </FieldRow>
                  )} />

                  {emailProvider !== 'smtp' && (
                    <FormField control={form.control} name="emailProviderApiKey" render={({ field }) => (
                      <FieldRow label="API key" hint="Your provider API secret">
                        <MaskedInput value={field.value ?? ''} onChange={field.onChange}
                          placeholder={`${EMAIL_PROVIDERS.find(p => p.id === emailProvider)?.name ?? 'Provider'} API key`} />
                      </FieldRow>
                    )} />
                  )}

                  {(emailProvider === 'mailgun' || emailProvider === 'ses') && (
                    <FormField control={form.control} name="emailProviderDomain" render={({ field }) => (
                      <FieldRow label={emailProvider === 'ses' ? 'AWS region' : 'Domain'}>
                        <Input placeholder={emailProvider === 'ses' ? 'us-east-1' : 'mg.yourdomain.com'} className="font-mono h-8 text-sm" {...field} />
                      </FieldRow>
                    )} />
                  )}

                  {emailProvider === 'smtp' && (
                    <FieldRow label="SMTP credentials" hint="Username, password and hostname">
                      <div className="space-y-2">
                        <FormField control={form.control} name="smtpUser" render={({ field }) => (
                          <Input placeholder="username@domain.com" className="font-mono h-8 text-sm" {...field} />
                        )} />
                        <FormField control={form.control} name="emailProviderApiKey" render={({ field }) => (
                          <MaskedInput value={field.value ?? ''} onChange={field.onChange} placeholder="Password" />
                        )} />
                        <FormField control={form.control} name="emailProviderDomain" render={({ field }) => (
                          <Input placeholder="smtp.domain.com" className="font-mono h-8 text-sm" {...field} />
                        )} />
                      </div>
                    </FieldRow>
                  )}
                </div>

                <SectionHeading>Diagnostic Send</SectionHeading>
                <FieldRow label="Test email" hint="Verify delivery through the active provider">
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input type="email" placeholder="recipient@example.com" value={testEmail}
                        onChange={(e) => { setTestEmail(e.target.value); setTestResult(null); }}
                        className="h-8 text-sm flex-1" />
                      <Button type="button" variant="outline" size="sm" className="h-8 shrink-0"
                        onClick={handleTestEmail} disabled={testSending || !testEmail}>
                        {testSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Send test'}
                      </Button>
                    </div>
                    {testResult && (
                      <div className={cn('flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded border',
                        testResult.success ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800')}>
                        {testResult.success ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <XCircle className="w-3.5 h-3.5 shrink-0" />}
                        {testResult.message}
                      </div>
                    )}
                  </div>
                </FieldRow>
              </div>
            )}

            {/* ══ NOTIFICATIONS ══════════════════════════════════════════ */}
            {activeSection === 'notifications' && (
              <div>
                <SectionHeading>Channels</SectionHeading>
                <div className="border-b border-border/60">
                  <FieldRow label="Email" hint="Always active — cannot be disabled">
                    <Badge variant="outline" className="text-[10px] font-semibold uppercase tracking-wider text-green-700 border-green-300 bg-green-50">
                      Always on
                    </Badge>
                  </FieldRow>
                  <FormField control={form.control} name="smsEnabled" render={({ field }) => (
                    <FieldRow label="SMS" hint="Text message notifications">
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FieldRow>
                  )} />
                  <FormField control={form.control} name="whatsappEnabled" render={({ field }) => (
                    <FieldRow label="WhatsApp" hint="WhatsApp message notifications">
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FieldRow>
                  )} />
                  <FormField control={form.control} name="defaultNotificationChannel" render={({ field }) => (
                    <FieldRow label="Default channel" hint="Used when recipient has no preference">
                      <ChipGroup value={field.value} onChange={field.onChange} options={[
                        { id: 'email', label: 'Email' },
                        ...(smsEnabled ? [{ id: 'sms', label: 'SMS' }] : []),
                        ...(whatsappEnabled ? [{ id: 'whatsapp', label: 'WhatsApp' }] : []),
                      ]} />
                    </FieldRow>
                  )} />
                </div>

                {smsEnabled && (
                  <>
                    <SectionHeading>SMS Provider</SectionHeading>
                    <div className="border-b border-border/60">
                      <FormField control={form.control} name="smsProvider" render={({ field }) => (
                        <FieldRow label="Provider">
                          <ProviderList options={SMS_PROVIDERS} value={field.value ?? ''} onChange={field.onChange} />
                        </FieldRow>
                      )} />
                      <FormField control={form.control} name="smsProviderApiKey" render={({ field }) => (
                        <FieldRow label="Account SID / API key">
                          <MaskedInput value={field.value ?? ''} onChange={field.onChange} placeholder="API key or SID" />
                        </FieldRow>
                      )} />
                      <FormField control={form.control} name="smsProviderSecret" render={({ field }) => (
                        <FieldRow label="Auth token / secret">
                          <MaskedInput value={field.value ?? ''} onChange={field.onChange} placeholder="Auth token or secret" />
                        </FieldRow>
                      )} />
                      <FormField control={form.control} name="smsProviderFrom" render={({ field }) => (
                        <FieldRow label="From number" hint="E.164 format e.g. +15551234567">
                          <Input placeholder="+15551234567" className="font-mono h-8 text-sm" {...field} />
                        </FieldRow>
                      )} />
                    </div>
                  </>
                )}

                {whatsappEnabled && (
                  <>
                    <SectionHeading>WhatsApp Provider</SectionHeading>
                    <div className="border-b border-border/60">
                      <FormField control={form.control} name="whatsappProvider" render={({ field }) => (
                        <FieldRow label="Provider">
                          <ProviderList options={WHATSAPP_PROVIDERS} value={field.value ?? ''} onChange={field.onChange} />
                        </FieldRow>
                      )} />
                      <FormField control={form.control} name="whatsappProviderApiKey" render={({ field }) => (
                        <FieldRow label="API key / token">
                          <MaskedInput value={field.value ?? ''} onChange={field.onChange} placeholder="API key or token" />
                        </FieldRow>
                      )} />
                      <FormField control={form.control} name="whatsappProviderFrom" render={({ field }) => (
                        <FieldRow label="From number / ID">
                          <Input placeholder="+15551234567" className="font-mono h-8 text-sm" {...field} />
                        </FieldRow>
                      )} />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ══ STORAGE ════════════════════════════════════════════════ */}
            {activeSection === 'storage' && (
              <div>
                <SectionHeading>Retention Policy</SectionHeading>
                <div className="border-b border-border/60">
                  <FieldRow label="Retention period" hint="Documents older than this are permanently deleted every 6 h">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <FormField control={form.control} name="retentionDays" render={({ field }) => (
                          <Input type="number" min={0} max={3650} className="font-mono h-8 text-sm w-24" {...field} />
                        )} />
                        <span className="text-sm text-muted-foreground">days</span>
                        <span className="text-xs text-muted-foreground">(0 = disabled)</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { label: 'Off', days: 0 }, { label: '7 d', days: 7 }, { label: '30 d', days: 30 },
                          { label: '90 d', days: 90 }, { label: '1 yr', days: 365 }, { label: '7 yr', days: 2555 },
                        ].map((p) => (
                          <button key={p.days} type="button" onClick={() => form.setValue('retentionDays', p.days)}
                            className={cn('px-2 py-0.5 rounded text-xs font-medium border transition-all',
                              retentionDays === p.days
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-background border-border text-muted-foreground hover:border-primary/50')}>
                            {p.label}
                          </button>
                        ))}
                      </div>
                      {retentionDays > 0 && (
                        <p className="text-xs text-amber-700 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          Documents older than {retentionDays} day{retentionDays !== 1 ? 's' : ''} will be permanently deleted.
                        </p>
                      )}
                    </div>
                  </FieldRow>
                </div>

                <SectionHeading>Upload Limits</SectionHeading>
                <div className="border-b border-border/60">
                  <FormField control={form.control} name="maxFileSizeMb" render={({ field }) => (
                    <FieldRow label="Max file size" hint="Hard limit per upload">
                      <div className="flex items-center gap-2">
                        <Input type="number" className="font-mono h-8 text-sm w-24" {...field} />
                        <span className="text-sm text-muted-foreground">MB</span>
                      </div>
                    </FieldRow>
                  )} />
                  <FormField control={form.control} name="maxRecipients" render={({ field }) => (
                    <FieldRow label="Max recipients" hint="Maximum targets per dispatch">
                      <div className="flex items-center gap-2">
                        <Input type="number" className="font-mono h-8 text-sm w-24" {...field} />
                        <span className="text-sm text-muted-foreground">recipients</span>
                      </div>
                    </FieldRow>
                  )} />
                </div>

                <SectionHeading>Accepted File Types</SectionHeading>
                <FieldRow label="Allowed formats" hint="Configured at database level">
                  <div className="flex flex-wrap gap-1.5">
                    {(settings?.allowedFileTypes ?? 'pdf,jpg,jpeg,png').split(',').map((ext) => (
                      <span key={ext} className="px-2 py-0.5 rounded border border-border bg-muted text-xs font-mono font-semibold uppercase text-foreground">
                        .{ext.trim()}
                      </span>
                    ))}
                  </div>
                </FieldRow>
              </div>
            )}

            {/* ══ SCANNER ════════════════════════════════════════════════ */}
            {activeSection === 'scanner' && (
              <div>
                <ScanToUrlSection />

                <SectionHeading>Device</SectionHeading>
                <div className="border-b border-border/60">
                  <FormField control={form.control} name="scannerName" render={({ field }) => (
                    <FieldRow label="Scanner model" hint="Display label for the active device">
                      <Input placeholder="e.g. Fujitsu fi-7160" className="h-8 text-sm" {...field} />
                    </FieldRow>
                  )} />
                </div>

                <SectionHeading>Page & Format</SectionHeading>
                <div className="border-b border-border/60">
                  <FormField control={form.control} name="scannerPaperSize" render={({ field }) => (
                    <FieldRow label="Paper size">
                      <ChipGroup value={field.value} onChange={field.onChange}
                        options={PAPER_SIZES.map(s => ({ id: s, label: s }))} />
                    </FieldRow>
                  )} />
                  <FormField control={form.control} name="scannerResolutionDpi" render={({ field }) => (
                    <FieldRow label="Resolution" hint="300 DPI recommended for documents">
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {DPI_OPTIONS.map((dpi) => (
                          <button key={dpi} type="button" onClick={() => field.onChange(dpi)}
                            className={cn('px-2 py-0.5 rounded border text-xs font-mono font-medium transition-all',
                              field.value === dpi
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-background border-border text-muted-foreground hover:border-primary/50')}>
                            {dpi}
                          </button>
                        ))}
                        <Input type="number" value={field.value} onChange={(e) => field.onChange(Number(e.target.value))}
                          className="w-20 font-mono h-7 text-xs" placeholder="Custom" />
                        <span className="text-xs text-muted-foreground">DPI</span>
                      </div>
                    </FieldRow>
                  )} />
                  <FormField control={form.control} name="scannerFileFormat" render={({ field }) => (
                    <FieldRow label="Output format">
                      <ChipGroup value={field.value} onChange={field.onChange}
                        options={FILE_FORMATS.map(f => ({ id: f, label: f.toUpperCase() }))} />
                    </FieldRow>
                  )} />
                </div>

                <SectionHeading>Image</SectionHeading>
                <div className="border-b border-border/60">
                  <FormField control={form.control} name="scannerColorMode" render={({ field }) => (
                    <FieldRow label="Color mode">
                      <ChipGroup value={field.value} onChange={field.onChange}
                        options={COLOR_MODES.map(c => ({ id: c.id, label: c.label }))} />
                    </FieldRow>
                  )} />
                  <FormField control={form.control} name="scannerDuplex" render={({ field }) => (
                    <FieldRow label="Duplex scanning" hint="Scan both sides automatically">
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FieldRow>
                  )} />
                  <FormField control={form.control} name="scannerBrightness" render={({ field }) => (
                    <FieldRow label="Brightness" hint={`${field.value > 0 ? '+' : ''}${field.value}`}>
                      <input type="range" min={-100} max={100} step={5} value={field.value}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                        className="w-full accent-primary" />
                    </FieldRow>
                  )} />
                  <FormField control={form.control} name="scannerContrast" render={({ field }) => (
                    <FieldRow label="Contrast" hint={`${field.value > 0 ? '+' : ''}${field.value}`}>
                      <input type="range" min={-100} max={100} step={5} value={field.value}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                        className="w-full accent-primary" />
                    </FieldRow>
                  )} />
                </div>

                <SectionHeading>Active Configuration</SectionHeading>
                <div className="grid grid-cols-4 gap-x-6 gap-y-3 pb-4">
                  {[
                    { label: 'Paper', value: form.watch('scannerPaperSize') },
                    { label: 'DPI',   value: `${form.watch('scannerResolutionDpi')}` },
                    { label: 'Format', value: (form.watch('scannerFileFormat') ?? 'pdf').toUpperCase() },
                    { label: 'Color', value: COLOR_MODES.find(c => c.id === form.watch('scannerColorMode'))?.label ?? '-' },
                    { label: 'Duplex', value: form.watch('scannerDuplex') ? 'On' : 'Off' },
                    { label: 'Brightness', value: `${form.watch('scannerBrightness') > 0 ? '+' : ''}${form.watch('scannerBrightness')}` },
                    { label: 'Contrast', value: `${form.watch('scannerContrast') > 0 ? '+' : ''}${form.watch('scannerContrast')}` },
                    { label: 'Device', value: form.watch('scannerName') || '—' },
                  ].map((item) => (
                    <div key={item.label}>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{item.label}</p>
                      <p className="text-sm font-semibold font-mono text-foreground mt-0.5">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      </form>
    </Form>
  );
}
