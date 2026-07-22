import { Link } from 'wouter';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-sidebar">
      <div className="text-center space-y-6 flex flex-col items-center">
        <div className="bg-primary/10 p-4 rounded-full border border-primary/20">
          <ShieldAlert className="w-12 h-12 text-primary" />
        </div>
        <div>
          <h1 className="text-6xl font-bold text-sidebar-foreground tracking-tight">404</h1>
          <h2 className="text-xl font-medium text-sidebar-foreground/80 mt-2">Destination Unknown</h2>
        </div>
        <p className="text-sidebar-foreground/60 max-w-md mx-auto">
          The requested path does not exist in the routing table. 
          Please return to a known sector.
        </p>
        <Button asChild className="mt-4" variant="outline">
          <Link href="/">
            <ArrowLeft className="w-4 h-4 mr-2" /> Return to Dashboard
          </Link>
        </Button>
      </div>
    </div>
  );
}
