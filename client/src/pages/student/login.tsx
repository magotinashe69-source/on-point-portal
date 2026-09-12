import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { studentLoginSchema, type StudentLogin } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { QrScanDialog } from "@/components/QrScanDialog";
import { ArrowLeft, LogIn, Loader2, Eye, EyeOff, Camera } from "lucide-react";
import { Link } from "wouter";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { serverMessage, useT } from "@/lib/i18n";
import logoPath from "@assets/logo.webp";

export default function StudentLoginPage() {
  const [location, setLocation] = useLocation();
  const { student, setStudent, forgetRememberedLogins } = useAuth();
  const { toast } = useToast();
  const t = useT();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (student) {
      setLocation("/student/dashboard");
    }
  }, [student, setLocation]);

  const form = useForm<StudentLogin>({
    resolver: zodResolver(studentLoginSchema),
    defaultValues: {
      fullName: "",
      password: "",
    },
  });

  // Whether to offer card login at all. enumerateDevices resolves without a
  // permission prompt, so this costs the parent nothing and avoids showing a
  // button that could only fail. Anything unexpected means "assume no camera".
  const [hasCamera, setHasCamera] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices?.enumerateDevices?.()
      .then(devices => {
        if (!cancelled) setHasCamera(devices.some(d => d.kind === "videoinput"));
      })
      .catch(() => { /* leave the button hidden */ });
    return () => { cancelled = true; };
  }, []);

  /**
   * A card was read. The server decides whether it is good — the browser only
   * carries the code across and reacts to the answer.
   */
  async function onScanned(code: string): Promise<string | null> {
    try {
      // Plain fetch, not apiRequest: that helper throws on any non-2xx, which
      // would turn the rate limiter's 429 and its explanation into a generic
      // connection error. Here the server's own wording is what the child
      // needs to read.
      const res = await fetch("/api/auth/student/scan-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!data.success) return serverMessage(t, data, t.login.student.cardNotRecognised);

      // Same as the form login below: forget any teacher or parent this
      // browser is remembering, without posting a logout that would destroy
      // the session the scan has just created.
      forgetRememberedLogins();
      setStudent(data.student);
      setScanOpen(false);
      toast({ title: t.login.student.welcome(String(data.student.fullName || "").split(" ")[0]) });
      setLocation("/student/dashboard");
      return null;
    } catch {
      return t.common.checkConnection;
    }
  }

  async function onSubmit(values: StudentLogin) {
    setIsLoading(true);
    try {
      const response = await apiRequest("POST", "/api/auth/student/login", values);
      const data = await response.json();
      
      if (data.success) {
        // Clear any teacher or parent remembered in this browser before
        // setting the student. Not logout(): that would post to
        // /api/auth/student/logout and destroy the session this login had just
        // created, leaving every request 401 afterwards.
        forgetRememberedLogins();
        const message = data.isFirstLogin 
          ? t.login.student.passwordSet
          : t.login.student.welcomeBack(data.student.fullName);
        toast({
          title: t.login.loggedIn,
          description: message,
        });
        setStudent(data.student);
      } else {
        toast({
          title: t.login.loginFailed,
          description: serverMessage(t, data, t.login.student.invalidCredentials),
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: t.login.loginFailed,
        description: t.login.student.tryAgain,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  if (student) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
          <Link href="/" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">{t.common.backToHome}</span>
          </Link>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <img src={logoPath} alt="On Point Education Centre" className="h-20 w-auto" />
            </div>
            <CardTitle className="text-2xl">{t.login.student.title}</CardTitle>
            <CardDescription>
              {t.login.student.description}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.login.student.nameLabel}</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder={t.login.student.namePlaceholder} 
                          data-testid="input-fullname"
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
                      <FormLabel>{t.common.password}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input 
                            type={showPassword ? "text" : "password"}
                            placeholder={t.login.student.passwordPlaceholder} 
                            className="pr-10"
                            data-testid="input-password"
                            {...field} 
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                            aria-label={showPassword ? t.common.hidePassword : t.common.showPassword}
                            data-testid="button-toggle-password"
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isLoading}
                  data-testid="button-login"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <LogIn className="h-4 w-4 mr-2" />
                  )}
                  {t.login.signIn}
                </Button>
              </form>
            </Form>

            {/* Card login. Hidden entirely when the device has no camera, so a
                parent on a desktop is never offered something that cannot
                work. Sits below the password form because it is the addition,
                not the replacement. */}
            {hasCamera && (
              <Button
                type="button"
                variant="outline"
                className="w-full mt-3 h-12 text-base"
                onClick={() => setScanOpen(true)}
                data-testid="button-scan-login"
              >
                <Camera className="h-5 w-5 mr-2" />
                {t.login.student.scanCard}
              </Button>
            )}

            <QrScanDialog
              open={scanOpen}
              onOpenChange={setScanOpen}
              onScanned={onScanned}
            />
            <div className="mt-6 p-4 bg-muted rounded-md">
              <p className="text-sm text-muted-foreground text-center">
                {t.login.student.firstTime}
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
