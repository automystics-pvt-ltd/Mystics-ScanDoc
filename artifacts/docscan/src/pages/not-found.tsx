import { AlertCircle, ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center bg-background p-4 relative overflow-hidden selection:bg-primary/20">
      {/* Background decoration */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[100px] pointer-events-none -z-10" />
      
      <div className="max-w-md w-full text-center space-y-8 relative z-10 animate-slide-down-fade">
        <div className="flex justify-center">
          <div className="w-24 h-24 bg-card border border-border shadow-lg rounded-2xl flex items-center justify-center relative">
            <div className="absolute -top-3 -right-3 w-8 h-8 bg-destructive/10 border border-destructive/20 text-destructive rounded-full flex items-center justify-center animate-pulse">
              <AlertCircle className="w-4 h-4" />
            </div>
            <span className="text-5xl font-mono font-bold text-muted-foreground opacity-50 tracking-tighter">404</span>
          </div>
        </div>
        
        <div className="space-y-3">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">Sector Not Found</h1>
          <p className="text-lg text-muted-foreground">
            The requested module or directory does not exist in the mailroom registry.
          </p>
        </div>

        <div className="pt-6 border-t border-border/50">
          <Button asChild size="lg" className="w-full sm:w-auto h-12 px-8 font-semibold shadow-[0_0_20px_rgba(var(--primary),0.15)] group">
            <Link href="/">
              <ArrowLeft className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform" />
              Return to Operations
            </Link>
          </Button>
        </div>
        
        <div className="mt-12">
          <div className="inline-flex items-center gap-2 bg-muted px-3 py-1.5 rounded text-xs font-mono text-muted-foreground border border-border">
            <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
            ERR_PATH_UNRESOLVED
          </div>
        </div>
      </div>
    </div>
  );
}
