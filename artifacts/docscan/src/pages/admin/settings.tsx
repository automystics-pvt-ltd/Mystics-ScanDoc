import { useState, useEffect } from 'react';
import {
  useGetSettings, useUpdateSettings, getGetSettingsQueryKey,
  useHealthCheck,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Save, Loader2, Mail, CheckCircle2, XCircle, AlertCircle,
  SlidersHorizontal, AlertTriangle, ScanLine,
  Camera, FileType, MessageSquare, Phone, Clock,
  Printer, Zap, Eye, EyeOff, RefreshCw, Copy, RotateCcw, Wifi,
  ShieldCheck, Link2, FlaskConical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Form, FormControl, FormField, FormItem } from '@/components/ui/form';
import { getApiUrl } from '@/lib/api';
import { cn } from '@/lib/utils';

// ── Constants ────────────────────────────────────────────────────────────────

const EMAIL_PROVIDERS = [
  { id: 'resend',   name: 'Resend',      desc: 'Transactional email API' },
  { id: 'sendgrid', name: 'SendGrid',    desc: 'Twilio SendGrid' },
  { id: 'mailgun',  name: 'Mailgun',     desc: 'Mailgun email API' },
  { id: 'ses',      name: 'AWS SES',     desc: 'Amazon Simple Email Service' },
  { id: 'postmark', name: 'Postmark',    desc: 'Postmark transactional email' },
  { id: 'smtp',     name: 'Custom SMTP', desc: 'Any SMTP server' },
];
const SMS_PROVIDERS = [
  { id: 'twilio',      name: 'Twilio',      desc: 'Industry-leading SMS API' },
  { id: 'vonage',      name: 'Vonage',       desc: 'Vonage SMS (formerly Nexmo)' },
  { id: 'messagebird', name: 'MessageBird',  desc: 'MessageBird SMS' },
];
const WHATSAPP_PROVIDERS = [
  { id: 'twilio', name: 'Twilio WhatsApp',   desc: 'WhatsApp via Twilio API' },
  { id: 'meta',   name: 'Meta Business API', desc: 'Official WhatsApp Business API' },
];
const PAPER_SIZES  = ['A4', 'A3', 'A5', 'Letter', 'Legal', 'Tabloid', 'Custom'];
const DPI_OPTIONS  = [75, 150, 200, 300, 600, 1200];
const COLOR_MODES  = [
  { id: 'color',      label: 'Color' },
  { id: 'grayscale',  label: 'Grayscale' },
  { id: 'blackwhite', label: 'B&W' },
];
const FILE_FORMATS = ['pdf', 'jpg', 'png'];

// ── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  smtpUser:                   z.string().optional(),
  emailProvider:              z.string().default('resend'),
  emailProviderApiKey:        z.string().optional(),
  emailProviderDomain:        z.string().optional(),
  smsEnabled:                 z.boolean().default(false),
  smsProvider:                z.string().optional(),
  smsProviderApiKey:          z.string().optional(),
  smsProviderSecret:          z.string().optional(),
  smsProviderFrom:            z.string().optional(),
  whatsappEnabled:            z.boolean().default(false),
  whatsappProvider:           z.string().optional(),
  whatsappProviderApiKey:     z.string().optional(),
  whatsappProviderFrom:       z.string().optional(),
  defaultNotificationChannel: z.string().default('email'),
  maxRecipients:              z.coerce.number().min(1).max(10),
  maxFileSizeMb:              z.coerce.number().min(1).max(50),
  retentionDays:              z.coerce.number().min(0).max(3650),
  scannerName:                z.string().optional(),
  scannerPaperSize:           z.string().default('A4'),
  scannerResolutionDpi:       z.coerce.number().default(300),
  scannerColorMode:           z.string().default('color'),
  scannerFileFormat:          z.string().default('pdf'),
  scannerDuplex:              z.boolean().default(false),
  scannerBrightness:          z.coerce.number().min(-100).max(100).default(0),
  scannerContrast:            z.coerce.number().min(-100).max(100).default(0),
});
type SF = z.infer<typeof schema>;
type Section = 'email' | 'notifications' | 'storage' | 'scanner';

// ── Primitives ────────────────────────────────────────────────────────────────

/** Two-column setting row — label/hint left, control right */
function Row({
  label, hint, saved, children, top,
}: {
  label: string; hint?: string; saved?: boolean; children: React.ReactNode; top?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-3 border-b border-border/50 last:border-0">
      <div className="w-48 shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-foreground">{label}</span>
          {saved && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-green-700 bg-green-50 border border-green-200 rounded px-1 py-px">
              <ShieldCheck className="w-2.5 h-2.5" /> Saved
            </span>
          )}
        </div>
        {hint && <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{hint}</p>}
      </div>
      <div className={cn('flex-1 max-w-xs', top && 'mt-0.5')}>{children}</div>
    </div>
  );
}

function SectionHead({ label }: { label: string }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 pt-5 pb-0.5 first:pt-0 select-none">
      {label}
    </p>
  );
}

/** Masked secret field with show/hide toggle */
function Secret({
  value, onChange, placeholder, saved,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; saved?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'font-mono text-sm pr-9 h-8',
          saved && !value && 'border-dashed',
        )}
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
      >
        {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

/** Compact radio-list for provider selection */
function ProviderPicker({
  options, value, onChange, savedId,
}: {
  options: { id: string; name: string; desc: string }[];
  value: string;
  onChange: (v: string) => void;
  savedId?: string | null;
}) {
  return (
    <div className="divide-y divide-border/50 rounded-md border border-border overflow-hidden">
      {options.map(o => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cn(
            'w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors text-sm group',
            value === o.id ? 'bg-primary/[0.04]' : 'bg-card hover:bg-muted/30',
          )}
        >
          {/* Radio dot */}
          <span className={cn(
            'w-3.5 h-3.5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors',
            value === o.id ? 'border-primary' : 'border-muted-foreground/30',
          )}>
            {value === o.id && <span className="w-1.5 h-1.5 rounded-full bg-primary block" />}
          </span>
          <span className="font-medium text-foreground">{o.name}</span>
          <span className="text-xs text-muted-foreground">{o.desc}</span>
          {/* "Active" pill on the currently-saved provider */}
          {savedId === o.id && (
            <span className="ml-auto text-[9px] font-bold uppercase tracking-wider text-green-700 bg-green-50 border border-green-200 rounded px-1.5 py-0.5">
              Active
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/** Chip-style button group */
function Chips({
  options, value, onChange,
}: {
  options: { id: string; label: string }[];
  value: string | number;
  onChange: (v: any) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(o => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cn(
            'px-2.5 py-1 rounded text-xs font-medium border transition-all',
            String(value) === String(o.id)
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-card border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── Scan-to-URL section ───────────────────────────────────────────────────────

function ScanToUrlSection() {
  const [apiKey,      setApiKey]      = useState<string | null>(null);
  const [showKey,     setShowKey]     = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [regenerating,setRegenerating]= useState(false);
  const { toast } = useToast();
  const endpointUrl = `${window.location.origin}${import.meta.env.BASE_URL}api/scanner/receive`;

  const fetchKey = async () => {
    try {
      const token = localStorage.getItem('docscan_token');
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/scanner/key`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) { const d = await res.json(); setApiKey(d.scannerApiKey ?? null); }
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { fetchKey(); }, []);

  const copy = (text: string, label: string) =>
    navigator.clipboard.writeText(text).then(() => toast({ title: `${label} copied` }));

  const regen = async () => {
    setRegenerating(true);
    try {
      const token = localStorage.getItem('docscan_token');
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/scanner/regen-key`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d = await res.json(); setApiKey(d.scannerApiKey ?? null);
        toast({ title: 'Key regenerated', description: 'Update your scanner configuration.' });
      }
    } catch { /* ignore */ } finally { setRegenerating(false); }
  };

  return (
    <>
      <SectionHead label="Scan-to-URL" />
      <div className="border-b border-border/50">
        <Row label="Endpoint URL" hint="Scanners POST documents to this address">
          <div className="flex gap-1">
            <code className="flex-1 min-w-0 bg-muted border border-border rounded px-2 py-1.5 text-[11px] font-mono text-foreground truncate block">
              {endpointUrl}
            </code>
            <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0"
              onClick={() => copy(endpointUrl, 'Endpoint URL')}>
              <Copy className="w-3 h-3" />
            </Button>
          </div>
        </Row>

        <Row label="Scanner API key" hint="X-Scanner-Key header or ?key= param" saved={!!apiKey}>
          {loading ? (
            <div className="flex items-center gap-1.5 h-8 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" /> Loading…
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex gap-1">
                <code className="flex-1 min-w-0 bg-muted border border-border rounded px-2 py-1.5 text-[11px] font-mono text-foreground truncate block">
                  {showKey ? apiKey : '•'.repeat(Math.min(apiKey?.length ?? 0, 38))}
                </code>
                <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0"
                  onClick={() => setShowKey(s => !s)}>
                  {showKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </Button>
                <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0"
                  onClick={() => copy(apiKey ?? '', 'Scanner API key')}>
                  <Copy className="w-3 h-3" />
                </Button>
                <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0"
                  onClick={regen} disabled={regenerating}>
                  <RotateCcw className={cn('w-3 h-3', regenerating && 'animate-spin')} />
                </Button>
              </div>
              {!apiKey && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  No key generated yet. Saving scanner settings will auto-generate one.
                </p>
              )}
            </div>
          )}
        </Row>

        <Row label="Setup steps" hint="Fujitsu · Canon · Ricoh · HP · Kyocera">
          <ol className="text-xs text-muted-foreground space-y-1 list-decimal pl-3.5">
            <li>Open scanner web UI → <strong>Scan to URL</strong> / HTTP</li>
            <li>Paste the endpoint URL as destination</li>
            <li>Add header <code className="bg-muted px-1 rounded font-mono">X-Scanner-Key: &lt;key&gt;</code></li>
            <li>Set output format to PDF, JPEG, or PNG</li>
          </ol>
        </Row>
      </div>
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Settings() {
  const { data: settings, isLoading, isError: settingsError } = useGetSettings();
  const { data: health, isError: healthError } = useHealthCheck();
  const updateSettings = useUpdateSettings();
  const queryClient    = useQueryClient();
  const { toast }      = useToast();

  const [testEmail,  setTestEmail]  = useState('');
  const [testSending,setTestSending]= useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [section,    setSection]    = useState<Section>('email');

  const form = useForm<SF>({
    resolver: zodResolver(schema),
    defaultValues: {
      smtpUser: '', emailProvider: 'resend', emailProviderApiKey: '', emailProviderDomain: '',
      smsEnabled: false, smsProvider: 'twilio', smsProviderApiKey: '', smsProviderSecret: '',
      smsProviderFrom: '', whatsappEnabled: false, whatsappProvider: 'twilio',
      whatsappProviderApiKey: '', whatsappProviderFrom: '', defaultNotificationChannel: 'email',
      maxRecipients: 5, maxFileSizeMb: 10, retentionDays: 30,
      scannerName: '', scannerPaperSize: 'A4', scannerResolutionDpi: 300,
      scannerColorMode: 'color', scannerFileFormat: 'pdf', scannerDuplex: false,
      scannerBrightness: 0, scannerContrast: 0,
    },
  });

  useEffect(() => {
    if (!settings) return;
    form.reset({
      smtpUser:                   settings.smtpUser ?? '',
      emailProvider:              settings.emailProvider ?? 'resend',
      emailProviderApiKey:        settings.emailProviderApiKey ?? '',
      emailProviderDomain:        settings.emailProviderDomain ?? '',
      smsEnabled:                 settings.smsEnabled ?? false,
      smsProvider:                settings.smsProvider ?? 'twilio',
      smsProviderApiKey:          settings.smsProviderApiKey ?? '',
      smsProviderSecret:          settings.smsProviderSecret ?? '',
      smsProviderFrom:            settings.smsProviderFrom ?? '',
      whatsappEnabled:            settings.whatsappEnabled ?? false,
      whatsappProvider:           settings.whatsappProvider ?? 'twilio',
      whatsappProviderApiKey:     settings.whatsappProviderApiKey ?? '',
      whatsappProviderFrom:       settings.whatsappProviderFrom ?? '',
      defaultNotificationChannel: settings.defaultNotificationChannel ?? 'email',
      maxRecipients:              settings.maxRecipients,
      maxFileSizeMb:              settings.maxFileSizeMb,
      retentionDays:              settings.retentionDays ?? 30,
      scannerName:                settings.scannerName ?? '',
      scannerPaperSize:           settings.scannerPaperSize ?? 'A4',
      scannerResolutionDpi:       settings.scannerResolutionDpi ?? 300,
      scannerColorMode:           settings.scannerColorMode ?? 'color',
      scannerFileFormat:          settings.scannerFileFormat ?? 'pdf',
      scannerDuplex:              settings.scannerDuplex ?? false,
      scannerBrightness:          settings.scannerBrightness ?? 0,
      scannerContrast:            settings.scannerContrast ?? 0,
    });
  }, [settings, form]);

  const onSubmit = (values: SF) => {
    updateSettings.mutate({ data: values as any }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
        toast({ title: 'Settings saved', description: 'All changes have been applied.' });
      },
      onError: err =>
        toast({ title: 'Save failed', description: (err as any)?.data?.error ?? 'Unknown error', variant: 'destructive' }),
    });
  };

  // FIX: Use Bearer token, not cookies
  const handleTestEmail = async () => {
    if (!testEmail) return;
    setTestSending(true); setTestResult(null);
    try {
      const token = localStorage.getItem('docscan_token');
      const res = await fetch(`${getApiUrl()}admin/test-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ to: testEmail }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({ ok: true, msg: `Delivered — ref ${data.messageId ?? '—'}` });
      } else {
        setTestResult({ ok: false, msg: data.error ?? 'Dispatch failed' });
      }
    } catch {
      setTestResult({ ok: false, msg: 'Network error — check API server' });
    } finally { setTestSending(false); }
  };

  if (isLoading) return (
    <div className="flex items-center gap-2 p-10 text-sm text-muted-foreground">
      <Loader2 className="w-4 h-4 animate-spin" /> Loading settings…
    </div>
  );

  // Derived watchers
  const emailProvider    = form.watch('emailProvider');
  const smsEnabled       = form.watch('smsEnabled');
  const whatsappEnabled  = form.watch('whatsappEnabled');
  const retentionDays    = form.watch('retentionDays');
  const isDirty          = form.formState.isDirty;

  // Health / connection status
  const apiOnline = !healthError && health?.status === 'ok';

  // "Saved" indicators — what's already in the DB (from `settings`, not from form)
  const savedEmailKey    = !!settings?.emailProviderApiKey;
  const savedSmsKey      = !!settings?.smsProviderApiKey;
  const savedWaKey       = !!settings?.whatsappProviderApiKey;
  const savedFromAddr    = !!settings?.smtpUser;

  const NAV: { id: Section; label: string; icon: React.ElementType; badge?: string }[] = [
    { id: 'email',         label: 'Email',         icon: Mail },
    { id: 'notifications', label: 'Notifications', icon: MessageSquare },
    { id: 'storage',       label: 'Storage',       icon: Clock },
    { id: 'scanner',       label: 'Scanner',       icon: Printer },
  ];

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>

        {/* ── Page header ──────────────────────────────────────────────── */}
        <div className="flex items-start justify-between mb-4 gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              System configuration, integrations and scanner preferences
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Real API health status */}
            <div className={cn(
              'flex items-center gap-1.5 text-xs font-medium border rounded px-2.5 py-1.5 select-none',
              apiOnline
                ? 'bg-green-50 text-green-700 border-green-200'
                : 'bg-red-50 text-red-700 border-red-200',
            )}>
              <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', apiOnline ? 'bg-green-500' : 'bg-red-500')} />
              {apiOnline ? 'API Online' : 'API Unreachable'}
              <button
                type="button"
                onClick={() => queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() })}
                className="ml-0.5 hover:opacity-70 transition-opacity"
                title="Refresh"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>

            {/* Unsaved changes indicator */}
            {isDirty && (
              <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5">
                Unsaved changes
              </span>
            )}

            <Button
              type="submit"
              size="sm"
              disabled={updateSettings.isPending || !isDirty}
              className="gap-1.5 h-8"
            >
              {updateSettings.isPending
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Save className="w-3.5 h-3.5" />}
              Save changes
            </Button>
          </div>
        </div>

        {/* ── Warning banner ───────────────────────────────────────────── */}
        {!savedFromAddr && (
          <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-4">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>
              <strong>From address not configured.</strong>{' '}
              Emails only reach your Resend account. Add a verified sender address in the Email tab.
            </span>
          </div>
        )}

        {/* ── Two-column panel ─────────────────────────────────────────── */}
        <div className="flex border border-border rounded-lg overflow-hidden bg-card" style={{ minHeight: 580 }}>

          {/* Nav */}
          <nav className="w-40 shrink-0 border-r border-border bg-muted/20 py-2">
            {NAV.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setSection(id)}
                className={cn(
                  'w-full flex items-center gap-2 px-3.5 py-2 text-sm font-medium transition-colors text-left',
                  section === id
                    ? 'text-foreground bg-card border-r-2 border-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-card/60',
                )}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                {label}
              </button>
            ))}
          </nav>

          {/* Content */}
          <div className="flex-1 px-6 py-4 min-w-0 overflow-y-auto">

            {/* ══ EMAIL ════════════════════════════════════════════════ */}
            {section === 'email' && (
              <div>
                <SectionHead label="Sender Identity" />
                <div className="border-b border-border/50">
                  <FormField control={form.control} name="smtpUser" render={({ field }) => (
                    <Row label="From address" hint="Must be verified with your provider" saved={savedFromAddr}>
                      <Input placeholder="noreply@company.com" className="font-mono h-8 text-sm" {...field} />
                    </Row>
                  )} />
                </div>

                <SectionHead label="Email Service Provider" />
                <div className="border-b border-border/50">
                  <FormField control={form.control} name="emailProvider" render={({ field }) => (
                    <Row label="Provider" hint="Select the outbound service" top>
                      <ProviderPicker
                        options={EMAIL_PROVIDERS}
                        value={field.value}
                        onChange={field.onChange}
                        savedId={settings?.emailProvider}
                      />
                    </Row>
                  )} />

                  {emailProvider !== 'smtp' && (
                    <FormField control={form.control} name="emailProviderApiKey" render={({ field }) => (
                      <Row label="API key" hint="Provider secret key" saved={savedEmailKey}>
                        <Secret
                          value={field.value ?? ''}
                          onChange={field.onChange}
                          placeholder={`${EMAIL_PROVIDERS.find(p => p.id === emailProvider)?.name} API key`}
                          saved={savedEmailKey}
                        />
                        {savedEmailKey && !(field.value) && (
                          <p className="text-[11px] text-muted-foreground mt-1">
                            Key is stored. Leave blank to keep the current key.
                          </p>
                        )}
                      </Row>
                    )} />
                  )}

                  {(emailProvider === 'mailgun' || emailProvider === 'ses') && (
                    <FormField control={form.control} name="emailProviderDomain" render={({ field }) => (
                      <Row label={emailProvider === 'ses' ? 'AWS region' : 'Domain'}>
                        <Input
                          placeholder={emailProvider === 'ses' ? 'us-east-1' : 'mg.yourdomain.com'}
                          className="font-mono h-8 text-sm" {...field}
                        />
                      </Row>
                    )} />
                  )}

                  {emailProvider === 'smtp' && (
                    <Row label="SMTP credentials" hint="Username, password and host" top>
                      <div className="space-y-1.5">
                        <FormField control={form.control} name="smtpUser" render={({ field }) => (
                          <Input placeholder="username@domain.com" className="font-mono h-8 text-sm" {...field} />
                        )} />
                        <FormField control={form.control} name="emailProviderApiKey" render={({ field }) => (
                          <Secret value={field.value ?? ''} onChange={field.onChange} placeholder="Password" />
                        )} />
                        <FormField control={form.control} name="emailProviderDomain" render={({ field }) => (
                          <Input placeholder="smtp.domain.com" className="font-mono h-8 text-sm" {...field} />
                        )} />
                      </div>
                    </Row>
                  )}
                </div>

                <SectionHead label="Diagnostic Send" />
                <Row label="Send test email" hint="Verifies the active provider end-to-end">
                  <div className="space-y-1.5">
                    <div className="flex gap-1.5">
                      <Input
                        type="email"
                        placeholder="recipient@example.com"
                        value={testEmail}
                        onChange={e => { setTestEmail(e.target.value); setTestResult(null); }}
                        className="h-8 text-sm flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 shrink-0 gap-1"
                        onClick={handleTestEmail}
                        disabled={testSending || !testEmail}
                      >
                        {testSending
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <FlaskConical className="w-3 h-3" />}
                        Test
                      </Button>
                    </div>
                    {testResult && (
                      <div className={cn(
                        'flex items-start gap-1.5 text-xs px-2.5 py-1.5 rounded border',
                        testResult.ok
                          ? 'bg-green-50 border-green-200 text-green-800'
                          : 'bg-red-50 border-red-200 text-red-800',
                      )}>
                        {testResult.ok
                          ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-px" />
                          : <XCircle className="w-3.5 h-3.5 shrink-0 mt-px" />}
                        {testResult.msg}
                      </div>
                    )}
                  </div>
                </Row>
              </div>
            )}

            {/* ══ NOTIFICATIONS ════════════════════════════════════════ */}
            {section === 'notifications' && (
              <div>
                <SectionHead label="Channels" />
                <div className="border-b border-border/50">
                  <Row label="Email" hint="Always active — cannot be disabled">
                    <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider text-green-700 border-green-300 bg-green-50">
                      Always on
                    </Badge>
                  </Row>
                  <FormField control={form.control} name="smsEnabled" render={({ field }) => (
                    <Row label="SMS" hint="Text message notifications">
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </Row>
                  )} />
                  <FormField control={form.control} name="whatsappEnabled" render={({ field }) => (
                    <Row label="WhatsApp" hint="WhatsApp message notifications">
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </Row>
                  )} />
                  <FormField control={form.control} name="defaultNotificationChannel" render={({ field }) => (
                    <Row label="Default channel" hint="Used when recipient has no preference">
                      <Chips
                        value={field.value}
                        onChange={field.onChange}
                        options={[
                          { id: 'email', label: 'Email' },
                          ...(smsEnabled ? [{ id: 'sms', label: 'SMS' }] : []),
                          ...(whatsappEnabled ? [{ id: 'whatsapp', label: 'WhatsApp' }] : []),
                        ]}
                      />
                    </Row>
                  )} />
                </div>

                {smsEnabled && (
                  <>
                    <SectionHead label="SMS Provider" />
                    <div className="border-b border-border/50">
                      <FormField control={form.control} name="smsProvider" render={({ field }) => (
                        <Row label="Provider" top>
                          <ProviderPicker
                            options={SMS_PROVIDERS}
                            value={field.value ?? ''}
                            onChange={field.onChange}
                            savedId={settings?.smsProvider}
                          />
                        </Row>
                      )} />
                      <FormField control={form.control} name="smsProviderApiKey" render={({ field }) => (
                        <Row label="Account SID / API key" saved={savedSmsKey}>
                          <Secret value={field.value ?? ''} onChange={field.onChange} placeholder="API key or SID" saved={savedSmsKey} />
                          {savedSmsKey && !field.value && (
                            <p className="text-[11px] text-muted-foreground mt-1">Key stored. Leave blank to keep.</p>
                          )}
                        </Row>
                      )} />
                      <FormField control={form.control} name="smsProviderSecret" render={({ field }) => (
                        <Row label="Auth token / secret">
                          <Secret value={field.value ?? ''} onChange={field.onChange} placeholder="Auth token or secret" />
                        </Row>
                      )} />
                      <FormField control={form.control} name="smsProviderFrom" render={({ field }) => (
                        <Row label="From number" hint="E.164 e.g. +15551234567">
                          <Input placeholder="+15551234567" className="font-mono h-8 text-sm" {...field} />
                        </Row>
                      )} />
                    </div>
                  </>
                )}

                {whatsappEnabled && (
                  <>
                    <SectionHead label="WhatsApp Provider" />
                    <div className="border-b border-border/50">
                      <FormField control={form.control} name="whatsappProvider" render={({ field }) => (
                        <Row label="Provider" top>
                          <ProviderPicker
                            options={WHATSAPP_PROVIDERS}
                            value={field.value ?? ''}
                            onChange={field.onChange}
                            savedId={settings?.whatsappProvider}
                          />
                        </Row>
                      )} />
                      <FormField control={form.control} name="whatsappProviderApiKey" render={({ field }) => (
                        <Row label="API key / token" saved={savedWaKey}>
                          <Secret value={field.value ?? ''} onChange={field.onChange} placeholder="API key or token" saved={savedWaKey} />
                          {savedWaKey && !field.value && (
                            <p className="text-[11px] text-muted-foreground mt-1">Key stored. Leave blank to keep.</p>
                          )}
                        </Row>
                      )} />
                      <FormField control={form.control} name="whatsappProviderFrom" render={({ field }) => (
                        <Row label="From number / ID">
                          <Input placeholder="+15551234567" className="font-mono h-8 text-sm" {...field} />
                        </Row>
                      )} />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ══ STORAGE ══════════════════════════════════════════════ */}
            {section === 'storage' && (
              <div>
                <SectionHead label="Retention Policy" />
                <div className="border-b border-border/50">
                  <Row label="Retention period" hint="Documents older than this are deleted every 6 h. Set 0 to disable.">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <FormField control={form.control} name="retentionDays" render={({ field }) => (
                          <FormItem className="m-0">
                            <FormControl>
                              <Input type="number" min={0} max={3650} className="font-mono h-8 text-sm w-20" {...field} />
                            </FormControl>
                          </FormItem>
                        )} />
                        <span className="text-sm text-muted-foreground">days</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {[
                          { label: 'Off',  days: 0 },
                          { label: '7 d',  days: 7 },
                          { label: '30 d', days: 30 },
                          { label: '90 d', days: 90 },
                          { label: '1 yr', days: 365 },
                          { label: '7 yr', days: 2555 },
                        ].map(p => (
                          <button
                            key={p.days}
                            type="button"
                            onClick={() => form.setValue('retentionDays', p.days, { shouldDirty: true })}
                            className={cn(
                              'px-2 py-0.5 rounded text-xs font-medium border transition-all',
                              retentionDays === p.days
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-card border-border text-muted-foreground hover:border-primary/50',
                            )}
                          >
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
                      {retentionDays === 0 && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-green-600 shrink-0" />
                          Automatic deletion disabled — documents kept indefinitely.
                        </p>
                      )}
                    </div>
                  </Row>
                </div>

                <SectionHead label="Upload Limits" />
                <div className="border-b border-border/50">
                  <FormField control={form.control} name="maxFileSizeMb" render={({ field }) => (
                    <Row label="Max file size" hint="Hard limit per upload">
                      <div className="flex items-center gap-2">
                        <FormItem className="m-0">
                          <FormControl>
                            <Input type="number" className="font-mono h-8 text-sm w-20" {...field} />
                          </FormControl>
                        </FormItem>
                        <span className="text-sm text-muted-foreground">MB</span>
                      </div>
                    </Row>
                  )} />
                  <FormField control={form.control} name="maxRecipients" render={({ field }) => (
                    <Row label="Max recipients" hint="Max targets per dispatch">
                      <div className="flex items-center gap-2">
                        <FormItem className="m-0">
                          <FormControl>
                            <Input type="number" className="font-mono h-8 text-sm w-20" {...field} />
                          </FormControl>
                        </FormItem>
                        <span className="text-sm text-muted-foreground">recipients</span>
                      </div>
                    </Row>
                  )} />
                </div>

                <SectionHead label="Accepted File Types" />
                <Row label="Allowed formats" hint="Configured at DB level — contact admin to change">
                  <div className="flex flex-wrap gap-1.5">
                    {(settings?.allowedFileTypes ?? 'pdf,jpg,jpeg,png').split(',').map(ext => (
                      <span key={ext} className="px-2 py-0.5 rounded border border-border bg-muted text-[11px] font-mono font-semibold uppercase text-foreground">
                        .{ext.trim()}
                      </span>
                    ))}
                  </div>
                </Row>
              </div>
            )}

            {/* ══ SCANNER ══════════════════════════════════════════════ */}
            {section === 'scanner' && (
              <div>
                <ScanToUrlSection />

                <SectionHead label="Device" />
                <div className="border-b border-border/50">
                  <FormField control={form.control} name="scannerName" render={({ field }) => (
                    <Row label="Scanner model" hint="Display label for this device">
                      <Input placeholder="e.g. Fujitsu fi-7160" className="h-8 text-sm" {...field} />
                    </Row>
                  )} />
                </div>

                <SectionHead label="Page & Format" />
                <div className="border-b border-border/50">
                  <FormField control={form.control} name="scannerPaperSize" render={({ field }) => (
                    <Row label="Paper size">
                      <Chips value={field.value} onChange={field.onChange}
                        options={PAPER_SIZES.map(s => ({ id: s, label: s }))} />
                    </Row>
                  )} />
                  <FormField control={form.control} name="scannerResolutionDpi" render={({ field }) => (
                    <Row label="Resolution" hint="300 DPI recommended">
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {DPI_OPTIONS.map(dpi => (
                          <button
                            key={dpi}
                            type="button"
                            onClick={() => field.onChange(dpi)}
                            className={cn(
                              'px-2 py-0.5 rounded border text-xs font-mono font-medium transition-all',
                              field.value === dpi
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-card border-border text-muted-foreground hover:border-primary/50',
                            )}
                          >
                            {dpi}
                          </button>
                        ))}
                        <Input
                          type="number"
                          value={field.value}
                          onChange={e => field.onChange(Number(e.target.value))}
                          className="w-20 font-mono h-7 text-xs"
                          placeholder="Custom"
                        />
                        <span className="text-xs text-muted-foreground">DPI</span>
                      </div>
                    </Row>
                  )} />
                  <FormField control={form.control} name="scannerFileFormat" render={({ field }) => (
                    <Row label="Output format">
                      <Chips value={field.value} onChange={field.onChange}
                        options={FILE_FORMATS.map(f => ({ id: f, label: f.toUpperCase() }))} />
                    </Row>
                  )} />
                </div>

                <SectionHead label="Image" />
                <div className="border-b border-border/50">
                  <FormField control={form.control} name="scannerColorMode" render={({ field }) => (
                    <Row label="Color mode">
                      <Chips value={field.value} onChange={field.onChange}
                        options={COLOR_MODES.map(c => ({ id: c.id, label: c.label }))} />
                    </Row>
                  )} />
                  <FormField control={form.control} name="scannerDuplex" render={({ field }) => (
                    <Row label="Duplex scanning" hint="Scan both sides automatically">
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </Row>
                  )} />
                  <FormField control={form.control} name="scannerBrightness" render={({ field }) => (
                    <Row label="Brightness" hint={`${field.value > 0 ? '+' : ''}${field.value}`}>
                      <input type="range" min={-100} max={100} step={5}
                        value={field.value} onChange={e => field.onChange(Number(e.target.value))}
                        className="w-full accent-primary" />
                    </Row>
                  )} />
                  <FormField control={form.control} name="scannerContrast" render={({ field }) => (
                    <Row label="Contrast" hint={`${field.value > 0 ? '+' : ''}${field.value}`}>
                      <input type="range" min={-100} max={100} step={5}
                        value={field.value} onChange={e => field.onChange(Number(e.target.value))}
                        className="w-full accent-primary" />
                    </Row>
                  )} />
                </div>

                <SectionHead label="Active Configuration" />
                <div className="grid grid-cols-4 gap-x-4 gap-y-3 pb-2">
                  {[
                    { label: 'Paper',      value: form.watch('scannerPaperSize') },
                    { label: 'DPI',        value: String(form.watch('scannerResolutionDpi')) },
                    { label: 'Format',     value: (form.watch('scannerFileFormat') ?? 'pdf').toUpperCase() },
                    { label: 'Color',      value: COLOR_MODES.find(c => c.id === form.watch('scannerColorMode'))?.label ?? '-' },
                    { label: 'Duplex',     value: form.watch('scannerDuplex') ? 'On' : 'Off' },
                    { label: 'Brightness', value: `${form.watch('scannerBrightness') >= 0 ? '+' : ''}${form.watch('scannerBrightness')}` },
                    { label: 'Contrast',   value: `${form.watch('scannerContrast') >= 0 ? '+' : ''}${form.watch('scannerContrast')}` },
                    { label: 'Device',     value: form.watch('scannerName') || '—' },
                  ].map(item => (
                    <div key={item.label}>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{item.label}</p>
                      <p className="text-sm font-semibold font-mono text-foreground mt-0.5 truncate">{item.value}</p>
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
