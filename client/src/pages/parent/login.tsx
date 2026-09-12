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
import { parentLoginSchema, type ParentLogin } from "@shared/schema";
import { ArrowLeft, LogIn, Loader2, Eye, EyeOff } from "lucide-react";
import { Link } from "wouter";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { serverMessage, useT } from "@/lib/i18n";
import logoPath from "@assets/logo.webp";

export default function ParentLoginPage() {
  const [, setLocation] = useLocation();
  const { parent, setParent, forgetRememberedLogins } = useAuth();
  const { toast } = useToast();
  const t = useT();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (parent) {
      setLocation("/parent/dashboard");
    }
  }, [parent, setLocation]);

  const form = useForm<ParentLogin>({
    resolver: zodResolver(parentLoginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  async function onSubmit(values: ParentLogin) {
    setIsLoading(true);
    try {
      // Plain fetch rather than the apiRequest helper: that helper throws on
      // any non-2xx answer, which would turn the rate limiter's "wait a few
      // minutes" into a generic connection error. Here the server's own
      // wording is what the parent needs to read.
      const res = await fetch("/api/auth/parent/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(values),
      });
      const data = await res.json().catch(() => ({}));

      if (data.success) {
        // Clear any teacher or student remembered in this browser before
        // saving the parent. The server has already dropped those sessions;
        // this keeps the browser's copy in step.
        //
        // It must NOT be logout(): that posts to /api/auth/parent/logout and
        // would destroy the parent session the line above had just created,
        // leaving a dashboard that looks logged in while every request 401s.
        forgetRememberedLogins();
        setParent(data.parent);
        toast({
          title: t.login.loggedIn,
          description: t.login.parent.welcome(data.parent.fullName),
        });
      } else {
        toast({
          title: t.login.loginFailed,
          description: serverMessage(t, data, t.login.parent.tryAgain),
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: t.login.loginFailed,
        description: t.common.checkConnection,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  if (parent) {
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
            <CardTitle className="text-2xl">{t.login.parent.title}</CardTitle>
            <CardDescription>
              {t.login.parent.description}
            </CardDescription>
            {/* Shown when we sent the parent here because their login had
                quietly ended — otherwise it just looks like the app logged
                them out for no reason. */}
            {window.location.search.includes("expired=1") && (
              <p className="mt-3 rounded-md bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-sm text-amber-800 dark:text-amber-200" data-testid="text-session-expired">
                {t.login.parent.expired}
              </p>
            )}
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.login.parent.usernameLabel}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t.login.parent.usernamePlaceholder}
                          autoCapitalize="none"
                          autoCorrect="off"
                          data-testid="input-parent-username"
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
                            placeholder={t.login.parent.passwordPlaceholder}
                            className="pr-10"
                            data-testid="input-parent-password"
                            {...field}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                            aria-label={showPassword ? t.common.hidePassword : t.common.showPassword}
                            data-testid="button-toggle-parent-password"
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
                  data-testid="button-parent-login"
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

            <div className="mt-6 p-4 bg-muted rounded-md">
              <p className="text-sm text-muted-foreground text-center">
                Parent accounts are created by the school. If you do not have one yet,
                or you have forgotten your password, ask your child's teacher.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
