import { useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useLogin, LoginInput } from '@workspace/api-client-react';
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
        if (res.user.role === 'admin') {
          setLocation('/dashboard');
        } else {
          setLocation('/upload');
        }
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
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-background selection:bg-primary/20 selection:text-primary">
      {/* Visual / Brand Side */}
      <div className="hidden md:flex flex-1 bg-sidebar relative overflow-hidden flex-col items-center justify-center p-12">
        {/* Abstract background graphics */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-20 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-blue-600 blur-[150px]" />
        </div>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative z-10 max-w-md text-center flex flex-col items-center"
        >
          <div className="bg-primary/10 p-4 rounded-2xl mb-8 border border-primary/20 shadow-[0_0_40px_rgba(var(--primary),0.3)] backdrop-blur-sm">
            <ScanText className="w-16 h-16 text-primary" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight leading-tight mb-4">
            Digital Mailroom <br/>Precision.
          </h1>
          <p className="text-sidebar-foreground/70 text-lg">
            Fast, trustworthy document routing. The exact tool you need to scan, send, and track internal mail.
          </p>
        </motion.div>
      </div>

      {/* Auth Form Side */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12 relative">
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="w-full max-w-[400px]"
        >
          <div className="md:hidden flex items-center gap-3 mb-10 text-primary">
            <ScanText className="w-8 h-8" />
            <span className="font-bold text-2xl text-foreground tracking-tight">DocScan</span>
          </div>

          <div className="mb-10">
            <h2 className="text-3xl font-bold tracking-tight text-foreground mb-2">Welcome back</h2>
            <p className="text-muted-foreground">Sign in to your account to continue.</p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground/80 font-semibold uppercase tracking-wider text-xs">Email Address</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="name@company.com" 
                        className="h-12 bg-card border-border/60 focus-visible:ring-primary/30 text-base" 
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
                      <FormLabel className="text-foreground/80 font-semibold uppercase tracking-wider text-xs">Password</FormLabel>
                    </div>
                    <FormControl>
                      <Input 
                        type="password" 
                        placeholder="••••••••" 
                        className="h-12 bg-card border-border/60 focus-visible:ring-primary/30 text-base font-mono" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="pt-2">
                <Button type="submit" className="w-full h-12 text-base font-medium group" disabled={loginMutation.isPending}>
                  {loginMutation.isPending ? (
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  ) : (
                    <>
                      Sign In
                      <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
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
