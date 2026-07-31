import { useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useLogin } from '@workspace/api-client-react';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { ScanText, Loader2, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';

const loginSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(1, { message: "Password is required" }),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const loginMutation = useLogin();

  const onSubmit = (values: z.infer<typeof loginSchema>) => {
    loginMutation.mutate({ data: values }, {
      onSuccess: (res) => {
        login(res.token, res.user);
        // All users land on Physical Scanner first; admin can navigate to dashboard from sidebar
        setLocation('/upload');
      },
      onError: (error) => {
        toast({
          title: "Access Denied",
          description: (error as any).data?.error || "Invalid credentials provided.",
          variant: "destructive",
        });
      }
    });
  };

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-background">
      {/* Visual / Brand Side - Dark Navy */}
      <div className="hidden md:flex flex-1 bg-sidebar relative overflow-hidden flex-col items-center justify-center p-12">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative z-10 max-w-md flex flex-col"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="bg-primary p-2 rounded-lg flex items-center justify-center">
              <ScanText className="w-8 h-8 text-primary-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-3xl text-sidebar-foreground leading-none">DocScan</span>
              <span className="text-xs font-semibold text-sidebar-foreground/60 tracking-[0.2em] mt-1">ENTERPRISE</span>
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-sidebar-foreground tracking-tight leading-tight mb-6">
            Intelligent Document<br/>Routing Platform.
          </h1>
          <p className="text-sidebar-foreground/70 text-lg leading-relaxed">
            Securely scan, process, and automatically distribute physical mail across your organization's digital infrastructure.
          </p>
        </motion.div>
        
        {/* Subtle decorative element */}
        <div className="absolute bottom-0 right-0 p-12 opacity-10 pointer-events-none">
          <ScanText className="w-[400px] h-[400px] text-primary translate-x-1/4 translate-y-1/4" />
        </div>
      </div>

      {/* Auth Form Side - White */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12 bg-card relative">
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="w-full max-w-[400px]"
        >
          <div className="md:hidden flex items-center gap-3 mb-10">
            <div className="bg-primary p-1.5 rounded flex items-center justify-center">
              <ScanText className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="font-bold text-2xl text-foreground tracking-tight">DocScan</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold tracking-tight text-foreground mb-2">Sign in to your account</h2>
            <p className="text-muted-foreground text-sm">Enter your credentials to access the secure mailroom.</p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground font-semibold">Email</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="name@company.com" 
                        className="h-11 bg-background" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel className="text-foreground font-semibold">Password</FormLabel>
                    </div>
                    <FormControl>
                      <Input 
                        type="password" 
                        placeholder="••••••••" 
                        className="h-11 bg-background font-mono" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="pt-2">
                <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={loginMutation.isPending}>
                  {loginMutation.isPending ? (
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  ) : (
                    <>
                      Sign In
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </motion.div>
      </div>
    </div>
  );
}
