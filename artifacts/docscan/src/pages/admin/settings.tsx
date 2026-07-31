import { useState, useEffect, useRef } from 'react';
import {
  useGetSettings, useUpdateSettings, getGetSettingsQueryKey, useHealthCheck,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Save, Loader2, Mail, CheckCircle2, XCircle, AlertTriangle,
  Eye, EyeOff, Copy, RotateCcw, FlaskConical, Key,
  AtSign, Globe, Bell, HardDrive, Printer, Wifi,
  WifiOff, ShieldCheck, Check, ChevronRight,
  MessageSquare, Phone, Lock, Zap, Terminal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Form, FormControl, FormField, FormItem } from '@/components/ui/form';
import { getApiUrl } from '@/lib/api';
import { cn } from '@/lib/utils';

// ── Schema ────────────────────────────────────────────────────────────────────

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
  scannerWatchPath:           z.string().optional(),
  scannerAutoDispatch:        z.boolean().default(false),
});
type SF = z.infer<typeof schema>;
type Section = 'email' | 'notifications' | 'storage' | 'scanner';

// ── Provider data ─────────────────────────────────────────────────────────────

const EMAIL_PROVIDERS = [
  { id: 'resend',   label: 'Resend',      sub: 'Modern email API',       initials: 'Re', color: 'bg-red-500' },
  { id: 'sendgrid', label: 'SendGrid',    sub: 'Twilio SendGrid',        initials: 'SG', color: 'bg-blue-500' },
  { id: 'mailgun',  label: 'Mailgun',     sub: 'Flexible email API',     initials: 'Mg', color: 'bg-indigo-500' },
  { id: 'ses',      label: 'AWS SES',     sub: 'Amazon Simple Email',    initials: 'AWS',color: 'bg-orange-500' },
  { id: 'postmark', label: 'Postmark',    sub: 'Deliverability focused', initials: 'Pm', color: 'bg-yellow-500' },
  { id: 'smtp',     label: 'Custom SMTP', sub: 'Any SMTP server',        initials: '✉',  color: 'bg-slate-500' },
];
const SMS_PROVIDERS = [
  { id: 'twilio',      label: 'Twilio',       sub: 'Global SMS & voice',    initials: 'Tw', color: 'bg-red-500' },
  { id: 'vonage',      label: 'Vonage',        sub: 'Formerly Nexmo',        initials: 'Vg', color: 'bg-violet-500' },
  { id: 'messagebird', label: 'MessageBird',   sub: 'Communications API',    initials: 'MB', color: 'bg-teal-500' },
];
const WA_PROVIDERS = [
  { id: 'twilio', label: 'Twilio WA',    sub: 'WhatsApp via Twilio', initials: 'Tw', color: 'bg-red-500' },
  { id: 'meta',   label: 'Meta API',     sub: 'Official WA Business', initials: 'M',  color: 'bg-blue-600' },
];
const PAPER_SIZES  = ['A4','A3','A5','Letter','Legal'];
const DPI_OPTIONS  = [75,150,200,300,600,1200];
const COLOR_MODES  = [{ id:'color',label:'Color' },{ id:'grayscale',label:'Grayscale' },{ id:'blackwhite',label:'B & W' }];
const FILE_FORMATS = ['pdf','jpg','png'];

const SECTIONS = [
  { id: 'email' as Section,         label: 'Email',         Icon: Mail,      color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/30', ring: 'ring-orange-500/20' },
  { id: 'notifications' as Section, label: 'Notifications', Icon: Bell,      color: 'text-violet-500', bg: 'bg-violet-500/10', border: 'border-violet-500/30', ring: 'ring-violet-500/20' },
  { id: 'storage' as Section,       label: 'Storage',       Icon: HardDrive, color: 'text-sky-500',    bg: 'bg-sky-500/10',    border: 'border-sky-500/30',    ring: 'ring-sky-500/20' },
  { id: 'scanner' as Section,       label: 'Scanner',       Icon: Printer,   color: 'text-emerald-500',bg: 'bg-emerald-500/10',border: 'border-emerald-500/30',ring: 'ring-emerald-500/20' },
];

// ── Primitives ────────────────────────────────────────────────────────────────

/** Provider tile card */
function ProviderCard({
  p, selected, savedId, onClick,
}: {
  p: { id: string; label: string; sub: string; initials: string; color: string };
  selected: boolean; savedId?: string | null; onClick(): void;
}) {
  const isActive = savedId === p.id;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative flex flex-col gap-2 p-3 rounded-xl border text-left transition-all duration-150',
        selected
          ? 'border-primary bg-primary/[0.06] shadow-sm ring-1 ring-primary/20'
          : 'border-border bg-card hover:border-primary/30 hover:bg-muted/30',
      )}
    >
      {/* Active badge */}
      {isActive && (
        <span className="absolute top-2 right-2 inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-green-500 text-white">
          <Check className="w-2 h-2" /> Live
        </span>
      )}
      {/* Selected check */}
      {selected && !isActive && (
        <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
          <Check className="w-2.5 h-2.5 text-primary-foreground" />
        </span>
      )}
      {/* Avatar */}
      <span className={cn('w-8 h-8 rounded-lg flex items-center justify-center text-white text-[11px] font-bold shrink-0', p.color)}>
        {p.initials}
      </span>
      <div>
        <p className="text-sm font-semibold text-foreground leading-tight">{p.label}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{p.sub}</p>
      </div>
    </button>
  );
}

/** Secret input with show/hide */
function SecretInput({
  value, onChange, placeholder, className,
}: { value: string; onChange(v: string): void; placeholder?: string; className?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn('font-mono pr-9 h-9 text-sm', className)}
      />
      <button type="button" onClick={() => setShow(s => !s)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
        {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

/** Section heading */
function SHead({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/60 mb-3 mt-6 first:mt-0 select-none">
      {children}
    </p>
  );
}

/** Field row */
function Field({
  label, hint, badge, children,
}: { label: string; hint?: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[180px_1fr] gap-x-6 gap-y-0 items-start py-3.5 border-b border-border/40 last:border-0">
      <div>
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-foreground">{label}</span>
          {badge}
        </div>
        {hint && <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{hint}</p>}
      </div>
      <div>{children}</div>
    </div>
  );
}

/** Chip group */
function Chips({ options, value, onChange }: {
  options: { id: string; label: string }[];
  value: string | number;
  onChange(v: any): void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(o => (
        <button key={o.id} type="button" onClick={() => onChange(o.id)}
          className={cn(
            'px-2.5 py-1 rounded-md text-xs font-medium border transition-all',
            String(value) === String(o.id)
              ? 'bg-foreground text-background border-foreground'
              : 'bg-card border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground',
          )}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Key status badge */
function KeyBadge({ saved }: { saved: boolean }) {
  return saved
    ? <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-700 border border-green-500/20">
        <ShieldCheck className="w-2.5 h-2.5" /> Saved
      </span>
    : null;
}

// ── Scanner Scan-to-URL ───────────────────────────────────────────────────────

function ScanToUrlCard() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [regen, setRegen] = useState(false);
  const { toast } = useToast();
  const endpointUrl = `${window.location.origin}${import.meta.env.BASE_URL}api/scanner/receive`.replace(/\/+/g, '/').replace(':/', '://');

  useEffect(() => {
    const token = localStorage.getItem('docscan_token');
    fetch(`${import.meta.env.BASE_URL}api/admin/scanner/key`.replace(/\/+/g, '/'), {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.ok ? r.json() : null).then(d => d && setApiKey(d.scannerApiKey ?? null));
  }, []);

  const copy = (text: string, label: string) =>
    navigator.clipboard.writeText(text).then(() => toast({ title: `${label} copied to clipboard` }));

  const regenerate = async () => {
    setRegen(true);
    const token = localStorage.getItem('docscan_token');
    const res = await fetch(`${import.meta.env.BASE_URL}api/admin/scanner/regen-key`.replace(/\/+/g, '/'), {
      method: 'POST', headers: { Authorization: `Bearer ${token}` },
    }).catch(() => null);
    if (res?.ok) {
      const d = await res.json(); setApiKey(d.scannerApiKey);
      toast({ title: 'API key regenerated', description: 'Update your scanner configuration.' });
    }
    setRegen(false);
  };

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-muted/40 border-b border-border">
        <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center">
          <Zap className="w-3.5 h-3.5 text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Scan-to-URL Integration</p>
          <p className="text-xs text-muted-foreground">Physical scanners push documents to this endpoint</p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Endpoint */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-1.5">Endpoint</p>
          <div className="flex items-center gap-1.5">
            <code className="flex-1 min-w-0 font-mono text-[11px] bg-muted border border-border rounded-lg px-3 py-2 text-foreground truncate">
              {endpointUrl}
            </code>
            <button type="button" onClick={() => copy(endpointUrl, 'Endpoint URL')}
              className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-border bg-card hover:bg-muted transition-colors">
              <Copy className="w-3 h-3 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* API Key */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-1.5">Scanner API Key</p>
          <div className="flex items-center gap-1.5">
            <code className="flex-1 min-w-0 font-mono text-[11px] bg-muted border border-border rounded-lg px-3 py-2 text-foreground truncate">
              {apiKey
                ? show ? apiKey : '•'.repeat(Math.min(apiKey.length, 44))
                : <span className="text-muted-foreground italic">Not generated</span>}
            </code>
            {apiKey && (
              <button type="button" onClick={() => setShow(s => !s)}
                className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-border bg-card hover:bg-muted transition-colors">
                {show ? <EyeOff className="w-3 h-3 text-muted-foreground" /> : <Eye className="w-3 h-3 text-muted-foreground" />}
              </button>
            )}
            {apiKey && (
              <button type="button" onClick={() => copy(apiKey, 'Scanner API key')}
                className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-border bg-card hover:bg-muted transition-colors">
                <Copy className="w-3 h-3 text-muted-foreground" />
              </button>
            )}
            <button type="button" onClick={regenerate} disabled={regen}
              title="Regenerate key"
              className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-border bg-card hover:bg-muted transition-colors disabled:opacity-50">
              <RotateCcw className={cn('w-3 h-3 text-muted-foreground', regen && 'animate-spin')} />
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5">
            Send as <code className="bg-muted px-1 rounded font-mono">X-Scanner-Key</code> header or <code className="bg-muted px-1 rounded font-mono">?key=</code> query param.
          </p>
        </div>

        {/* Setup steps */}
        <div className="rounded-lg bg-muted/50 border border-border/50 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-2">Quick Setup</p>
          <ol className="space-y-1.5">
            {[
              'Open scanner web UI → Scan to URL / HTTP destination',
              'Paste endpoint URL as the destination address',
              'Add request header: X-Scanner-Key: <your key>',
              'Set output format to PDF, JPEG, or PNG',
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-2 text-[11px] text-muted-foreground">
                <span className="shrink-0 w-4 h-4 rounded-full bg-emerald-500/15 text-emerald-700 text-[9px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Settings() {
  const { data: settings, isLoading } = useGetSettings();
  const { data: health, isError: healthErr } = useHealthCheck();
  const updateSettings = useUpdateSettings();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [section, setSection]       = useState<Section>('email');
  const [testEmail, setTestEmail]   = useState('');
  const [testSending, setTestSend]  = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const sectionKey = useRef(0);

  const form = useForm<SF>({
    resolver: zodResolver(schema),
    defaultValues: {
      smtpUser:'', emailProvider:'resend', emailProviderApiKey:'', emailProviderDomain:'',
      smsEnabled:false, smsProvider:'twilio', smsProviderApiKey:'', smsProviderSecret:'', smsProviderFrom:'',
      whatsappEnabled:false, whatsappProvider:'twilio', whatsappProviderApiKey:'', whatsappProviderFrom:'',
      defaultNotificationChannel:'email', maxRecipients:5, maxFileSizeMb:10, retentionDays:30,
      scannerName:'', scannerPaperSize:'A4', scannerResolutionDpi:300, scannerColorMode:'color',
      scannerFileFormat:'pdf', scannerDuplex:false, scannerBrightness:0, scannerContrast:0,
      scannerWatchPath:'', scannerAutoDispatch:false,
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
      scannerWatchPath:           settings.scannerWatchPath ?? '',
      scannerAutoDispatch:        settings.scannerAutoDispatch ?? false,
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

  // Fixed: use Bearer token, not cookies
  const handleTestEmail = async () => {
    if (!testEmail) return;
    setTestSend(true); setTestResult(null);
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
      setTestResult(res.ok && data.success
        ? { ok: true,  msg: `Delivered · ref ${data.messageId ?? '—'}` }
        : { ok: false, msg: data.error ?? 'Dispatch failed' });
    } catch {
      setTestResult({ ok: false, msg: 'Network error — check API server' });
    }
    setTestSend(false);
  };

  const switchSection = (s: Section) => {
    sectionKey.current++;
    setSection(s);
  };

  if (isLoading) return (
    <div className="flex items-center gap-2 p-12 text-sm text-muted-foreground">
      <Loader2 className="w-4 h-4 animate-spin" /> Loading settings…
    </div>
  );

  const emailProvider   = form.watch('emailProvider');
  const smsEnabled      = form.watch('smsEnabled');
  const whatsappEnabled = form.watch('whatsappEnabled');
  const retentionDays   = form.watch('retentionDays');
  const isDirty         = form.formState.isDirty;

  const apiOnline     = !healthErr && health?.status === 'ok';
  const savedEmailKey = !!settings?.emailProviderApiKey;
  const savedSmsKey   = !!settings?.smsProviderApiKey;
  const savedWaKey    = !!settings?.whatsappProviderApiKey;

  const activeSec = SECTIONS.find(s => s.id === section)!;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 min-w-0">
            <h1 className="text-[22px] font-bold tracking-tight text-foreground leading-tight">Settings</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Integrations, delivery policy and hardware</p>
          </div>

          {/* API health */}
          <div className={cn(
            'flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold border select-none',
            apiOnline
              ? 'bg-green-50 text-green-700 border-green-200'
              : 'bg-red-50 text-red-700 border-red-200',
          )}>
            <span className={cn(
              'w-1.5 h-1.5 rounded-full',
              apiOnline ? 'bg-green-500 shadow-[0_0_0_3px_rgba(34,197,94,0.2)]' : 'bg-red-500',
            )} />
            {apiOnline ? 'API Online' : 'API Unreachable'}
          </div>

          {isDirty && (
            <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1.5">
              Unsaved changes
            </span>
          )}

          <Button type="submit" size="sm" disabled={updateSettings.isPending || !isDirty}
            className="gap-1.5 rounded-full h-8 px-4 font-semibold">
            {updateSettings.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save changes
          </Button>
        </div>

        {/* ── Body ────────────────────────────────────────────────────── */}
        <div className="flex gap-5 flex-1 min-h-0">

          {/* Nav rail */}
          <nav className="w-48 shrink-0">
            <div className="space-y-0.5">
              {SECTIONS.map(({ id, label, Icon, color, bg, border }) => {
                const active = section === id;
                return (
                  <button key={id} type="button" onClick={() => switchSection(id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left group',
                      active ? `${bg} ${color} ${border} border` : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                    )}>
                    <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center transition-all shrink-0',
                      active ? `${color} bg-white shadow-sm` : 'bg-muted/60 group-hover:bg-muted',
                    )}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <span>{label}</span>
                    {active && <ChevronRight className="w-3 h-3 ml-auto opacity-40" />}
                  </button>
                );
              })}
            </div>

            {/* Section status cards */}
            <div className="mt-6 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 px-3 mb-2">Status</p>
              {[
                {
                  label: 'Email',
                  ok: savedEmailKey || !!settings?.smtpUser,
                  detail: settings?.emailProvider ?? 'Not set',
                },
                {
                  label: 'SMS',
                  ok: !!settings?.smsEnabled && savedSmsKey,
                  detail: settings?.smsEnabled ? (settings.smsProvider ?? 'Enabled') : 'Disabled',
                },
                {
                  label: 'WhatsApp',
                  ok: !!settings?.whatsappEnabled && savedWaKey,
                  detail: settings?.whatsappEnabled ? (settings.whatsappProvider ?? 'Enabled') : 'Disabled',
                },
              ].map(s => (
                <div key={s.label} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30">
                  <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', s.ok ? 'bg-green-500' : 'bg-muted-foreground/30')} />
                  <span className="text-xs font-medium text-foreground">{s.label}</span>
                  <span className="text-[10px] text-muted-foreground ml-auto truncate max-w-[60px] capitalize">{s.detail}</span>
                </div>
              ))}
            </div>
          </nav>

          {/* Content panel */}
          <div
            key={`${section}-${sectionKey.current}`}
            className="flex-1 min-w-0 rounded-2xl border border-border bg-card overflow-y-auto"
            style={{ animation: 'settingsFadeIn 0.18s ease-out' }}
          >
            <style>{`
              @keyframes settingsFadeIn {
                from { opacity: 0; transform: translateY(6px); }
                to   { opacity: 1; transform: translateY(0); }
              }
            `}</style>

            {/* Section title strip */}
            <div className={cn('flex items-center gap-3 px-6 py-4 border-b border-border', activeSec.bg)}>
              <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center', activeSec.color, 'bg-white shadow-sm')}>
                <activeSec.Icon className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground">{activeSec.label}</h2>
                <p className="text-[11px] text-muted-foreground">
                  {section === 'email'         && 'Outbound delivery provider and API credentials'}
                  {section === 'notifications' && 'Channels, SMS, and WhatsApp configuration'}
                  {section === 'storage'       && 'Retention policy and upload constraints'}
                  {section === 'scanner'       && 'Physical scanner integration and device settings'}
                </p>
              </div>
            </div>

            <div className="px-6 py-5">

              {/* ════ EMAIL ════════════════════════════════════════════ */}
              {section === 'email' && (
                <div>
                  <SHead>Email Service Provider</SHead>
                  <FormField control={form.control} name="emailProvider" render={({ field }) => (
                    <div className="grid grid-cols-3 gap-2.5 mb-6">
                      {EMAIL_PROVIDERS.map(p => (
                        <ProviderCard key={p.id} p={p} selected={field.value === p.id}
                          savedId={settings?.emailProvider} onClick={() => field.onChange(p.id)} />
                      ))}
                    </div>
                  )} />

                  <SHead>Credentials</SHead>

                  {emailProvider !== 'smtp' && (
                    <Field label="API key" hint="Provider secret for sending" badge={<KeyBadge saved={savedEmailKey} />}>
                      <FormField control={form.control} name="emailProviderApiKey" render={({ field }) => (
                        <div className="space-y-1">
                          <SecretInput value={field.value ?? ''} onChange={field.onChange}
                            placeholder={`${EMAIL_PROVIDERS.find(p => p.id === emailProvider)?.label} API key`} />
                          {savedEmailKey && !field.value && (
                            <p className="text-[11px] text-muted-foreground">
                              Key is stored. Leave blank to keep the current value.
                            </p>
                          )}
                        </div>
                      )} />
                    </Field>
                  )}

                  {(emailProvider === 'mailgun' || emailProvider === 'ses') && (
                    <Field label={emailProvider === 'ses' ? 'AWS region' : 'Sending domain'}>
                      <FormField control={form.control} name="emailProviderDomain" render={({ field }) => (
                        <Input placeholder={emailProvider === 'ses' ? 'us-east-1' : 'mg.company.com'}
                          className="font-mono h-9 text-sm" {...field} />
                      )} />
                    </Field>
                  )}

                  {emailProvider === 'smtp' && (
                    <>
                      <Field label="SMTP host">
                        <FormField control={form.control} name="emailProviderDomain" render={({ field }) => (
                          <Input placeholder="smtp.company.com" className="font-mono h-9 text-sm" {...field} />
                        )} />
                      </Field>
                      <Field label="Username">
                        <FormField control={form.control} name="smtpUser" render={({ field }) => (
                          <Input placeholder="user@company.com" className="font-mono h-9 text-sm" {...field} />
                        )} />
                      </Field>
                      <Field label="Password" badge={<KeyBadge saved={savedEmailKey} />}>
                        <FormField control={form.control} name="emailProviderApiKey" render={({ field }) => (
                          <SecretInput value={field.value ?? ''} onChange={field.onChange} placeholder="SMTP password" />
                        )} />
                      </Field>
                    </>
                  )}

                  <SHead>Sender Identity</SHead>
                  <Field label="From address" hint="Verified with your provider">
                    <FormField control={form.control} name="smtpUser" render={({ field }) => (
                      <div className="relative">
                        <AtSign className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input placeholder="noreply@company.com" className="pl-7 font-mono h-9 text-sm" {...field} />
                      </div>
                    )} />
                  </Field>

                  <SHead>Diagnostic Send</SHead>
                  <Field label="Test delivery" hint="Sends a live message via the active provider">
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Input type="email" placeholder="recipient@example.com"
                          value={testEmail} onChange={e => { setTestEmail(e.target.value); setTestResult(null); }}
                          className="h-9 text-sm flex-1" />
                        <Button type="button" variant="outline" size="sm" className="h-9 shrink-0 gap-1.5 px-3"
                          onClick={handleTestEmail} disabled={testSending || !testEmail}>
                          {testSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FlaskConical className="w-3.5 h-3.5" />}
                          Send test
                        </Button>
                      </div>
                      {testResult && (
                        <div className={cn(
                          'flex items-start gap-2 text-xs px-3 py-2 rounded-lg border',
                          testResult.ok ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800',
                        )}>
                          {testResult.ok ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-px" /> : <XCircle className="w-3.5 h-3.5 shrink-0 mt-px" />}
                          {testResult.msg}
                        </div>
                      )}
                    </div>
                  </Field>
                </div>
              )}

              {/* ════ NOTIFICATIONS ════════════════════════════════════ */}
              {section === 'notifications' && (
                <div>
                  <SHead>Channels</SHead>
                  <div className="grid grid-cols-3 gap-3 mb-6">
                    {[
                      { label: 'Email',     desc: 'Always on',         enabled: true,   locked: true  },
                      { label: 'SMS',       desc: 'Text messages',     enabled: smsEnabled,       locked: false, key: 'smsEnabled' as keyof SF },
                      { label: 'WhatsApp',  desc: 'WA messaging',      enabled: whatsappEnabled,  locked: false, key: 'whatsappEnabled' as keyof SF },
                    ].map(ch => (
                      <div key={ch.label} className={cn(
                        'rounded-xl border p-4 transition-all',
                        ch.enabled ? 'border-primary/30 bg-primary/[0.03]' : 'border-border bg-card',
                      )}>
                        <div className="flex items-start justify-between mb-3">
                          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center',
                            ch.label === 'Email' ? 'bg-orange-100' : ch.label === 'SMS' ? 'bg-violet-100' : 'bg-green-100',
                          )}>
                            {ch.label === 'Email' ? <Mail className="w-4 h-4 text-orange-600" />
                              : ch.label === 'SMS' ? <Phone className="w-4 h-4 text-violet-600" />
                              : <MessageSquare className="w-4 h-4 text-green-600" />}
                          </div>
                          {ch.locked
                            ? <Lock className="w-3.5 h-3.5 text-muted-foreground/40 mt-1" />
                            : <FormField control={form.control} name={ch.key!} render={({ field }) => (
                                <Switch checked={!!field.value} onCheckedChange={field.onChange} />
                              )} />}
                        </div>
                        <p className="text-sm font-semibold text-foreground">{ch.label}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{ch.desc}</p>
                        {ch.enabled && !ch.locked && (
                          <span className="inline-flex items-center gap-0.5 mt-2 text-[9px] font-bold uppercase tracking-wider text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                            <Check className="w-2 h-2" /> Active
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  <SHead>Default Channel</SHead>
                  <Field label="Default" hint="Fallback when recipient has no preference">
                    <FormField control={form.control} name="defaultNotificationChannel" render={({ field }) => (
                      <Chips value={field.value} onChange={field.onChange}
                        options={[
                          { id: 'email', label: 'Email' },
                          ...(smsEnabled ? [{ id: 'sms', label: 'SMS' }] : []),
                          ...(whatsappEnabled ? [{ id: 'whatsapp', label: 'WhatsApp' }] : []),
                        ]} />
                    )} />
                  </Field>

                  {smsEnabled && (
                    <>
                      <SHead>SMS Provider</SHead>
                      <FormField control={form.control} name="smsProvider" render={({ field }) => (
                        <div className="grid grid-cols-3 gap-2.5 mb-4">
                          {SMS_PROVIDERS.map(p => (
                            <ProviderCard key={p.id} p={p} selected={field.value === p.id}
                              savedId={settings?.smsProvider} onClick={() => field.onChange(p.id)} />
                          ))}
                        </div>
                      )} />
                      <Field label="Account SID / Key" badge={<KeyBadge saved={savedSmsKey} />}>
                        <FormField control={form.control} name="smsProviderApiKey" render={({ field }) => (
                          <div className="space-y-1">
                            <SecretInput value={field.value ?? ''} onChange={field.onChange} placeholder="Account SID or API key" />
                            {savedSmsKey && !field.value && <p className="text-[11px] text-muted-foreground">Key stored. Leave blank to keep.</p>}
                          </div>
                        )} />
                      </Field>
                      <Field label="Auth token">
                        <FormField control={form.control} name="smsProviderSecret" render={({ field }) => (
                          <SecretInput value={field.value ?? ''} onChange={field.onChange} placeholder="Auth token" />
                        )} />
                      </Field>
                      <Field label="From number" hint="E.164 format">
                        <FormField control={form.control} name="smsProviderFrom" render={({ field }) => (
                          <Input placeholder="+15551234567" className="font-mono h-9 text-sm" {...field} />
                        )} />
                      </Field>
                    </>
                  )}

                  {whatsappEnabled && (
                    <>
                      <SHead>WhatsApp Provider</SHead>
                      <FormField control={form.control} name="whatsappProvider" render={({ field }) => (
                        <div className="grid grid-cols-2 gap-2.5 mb-4">
                          {WA_PROVIDERS.map(p => (
                            <ProviderCard key={p.id} p={p} selected={field.value === p.id}
                              savedId={settings?.whatsappProvider} onClick={() => field.onChange(p.id)} />
                          ))}
                        </div>
                      )} />
                      <Field label="API key / token" badge={<KeyBadge saved={savedWaKey} />}>
                        <FormField control={form.control} name="whatsappProviderApiKey" render={({ field }) => (
                          <div className="space-y-1">
                            <SecretInput value={field.value ?? ''} onChange={field.onChange} placeholder="API key or access token" />
                            {savedWaKey && !field.value && <p className="text-[11px] text-muted-foreground">Key stored. Leave blank to keep.</p>}
                          </div>
                        )} />
                      </Field>
                      <Field label="From number / ID">
                        <FormField control={form.control} name="whatsappProviderFrom" render={({ field }) => (
                          <Input placeholder="+15551234567" className="font-mono h-9 text-sm" {...field} />
                        )} />
                      </Field>
                    </>
                  )}
                </div>
              )}

              {/* ════ STORAGE ══════════════════════════════════════════ */}
              {section === 'storage' && (
                <div>
                  <SHead>Retention Policy</SHead>

                  {/* Visual retention selector */}
                  <div className="rounded-xl border border-border p-4 mb-5">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Document Retention</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {retentionDays === 0
                            ? 'Documents are kept indefinitely'
                            : `Documents older than ${retentionDays} day${retentionDays !== 1 ? 's' : ''} are permanently deleted`}
                        </p>
                      </div>
                      <FormField control={form.control} name="retentionDays" render={({ field }) => (
                        <div className="flex items-center gap-2">
                          <Input type="number" min={0} max={3650} className="font-mono h-8 text-sm w-20 text-right"
                            {...field} />
                          <span className="text-sm text-muted-foreground">days</span>
                        </div>
                      )} />
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {[
                        { label: 'Off',   days: 0,    desc: 'Keep forever' },
                        { label: '7 d',   days: 7,    desc: '1 week' },
                        { label: '30 d',  days: 30,   desc: '1 month' },
                        { label: '90 d',  days: 90,   desc: '3 months' },
                        { label: '1 yr',  days: 365,  desc: '1 year' },
                        { label: '7 yr',  days: 2555, desc: '7 years (legal)' },
                      ].map(p => (
                        <button key={p.days} type="button"
                          onClick={() => form.setValue('retentionDays', p.days, { shouldDirty: true })}
                          className={cn(
                            'flex flex-col items-center px-3 py-2 rounded-lg border text-xs font-semibold transition-all',
                            retentionDays === p.days
                              ? 'bg-foreground text-background border-foreground'
                              : 'bg-card border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground',
                          )}>
                          <span>{p.label}</span>
                          <span className={cn('text-[9px] font-normal mt-0.5', retentionDays === p.days ? 'text-background/70' : 'text-muted-foreground/60')}>{p.desc}</span>
                        </button>
                      ))}
                    </div>
                    {retentionDays > 0 && (
                      <div className="flex items-center gap-2 mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        Automatic deletion runs every 6 hours. This action is irreversible.
                      </div>
                    )}
                  </div>

                  <SHead>Upload Limits</SHead>
                  <div className="grid grid-cols-2 gap-4 mb-5">
                    <FormField control={form.control} name="maxFileSizeMb" render={({ field }) => (
                      <div className="rounded-xl border border-border p-4">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Max file size</p>
                        <div className="flex items-baseline gap-1.5">
                          <Input type="number" className="font-mono h-9 text-lg font-bold w-20" {...field} />
                          <span className="text-sm text-muted-foreground">MB</span>
                        </div>
                      </div>
                    )} />
                    <FormField control={form.control} name="maxRecipients" render={({ field }) => (
                      <div className="rounded-xl border border-border p-4">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Max recipients</p>
                        <div className="flex items-baseline gap-1.5">
                          <Input type="number" className="font-mono h-9 text-lg font-bold w-20" {...field} />
                          <span className="text-sm text-muted-foreground">per send</span>
                        </div>
                      </div>
                    )} />
                  </div>

                  <SHead>Accepted File Types</SHead>
                  <div className="flex flex-wrap gap-2">
                    {(settings?.allowedFileTypes ?? 'pdf,jpg,jpeg,png').split(',').map(ext => (
                      <span key={ext} className="font-mono text-xs font-bold uppercase px-3 py-1.5 rounded-lg border border-border bg-muted text-foreground">
                        .{ext.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* ════ SCANNER ══════════════════════════════════════════ */}
              {section === 'scanner' && (
                <div className="space-y-6">
                  <ScanToUrlCard />

                  <div>
                    <SHead>Folder & Dispatch</SHead>

                    <Field label="Watch folder path" hint="Folder where HP scanner saves files (shown to users as reference)">
                      <FormField control={form.control} name="scannerWatchPath" render={({ field }) => (
                        <Input placeholder="e.g. C:\Users\Name\Documents\HP Scans" className="h-9 text-sm font-mono" {...field} />
                      )} />
                    </Field>

                    <Field
                      label="Auto-dispatch on scan"
                      hint={form.watch('scannerAutoDispatch')
                        ? 'Documents dispatch immediately when received — no user action needed'
                        : 'User must click Dispatch after each scan arrives'}
                    >
                      <FormField control={form.control} name="scannerAutoDispatch" render={({ field }) => (
                        <div className="flex items-center gap-3">
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                          <span className={cn(
                            'text-xs font-semibold px-2 py-0.5 rounded-full',
                            field.value
                              ? 'bg-green-100 text-green-700 border border-green-200'
                              : 'bg-muted text-muted-foreground border border-border',
                          )}>
                            {field.value ? 'Auto' : 'Manual'}
                          </span>
                        </div>
                      )} />
                    </Field>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </form>
    </Form>
  );
}
