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
import { teacherLoginSchema, type TeacherLogin } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, LogIn, Loader2, Eye, EyeOff } from "lucide-react";
import { Link } from "wouter";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { useT } from "@/lib/i18n";
import logoPath from "@assets/logo.webp";

export default function TeacherLogin() {
  const [location, setLocation] = useLocation();
  const { teacher, setTeacher, forgetRememberedLogins } = useAuth();
  const { toast } = useToast();
  const t = useT();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (teacher) {
      setLocation("/teacher/dashboard");
    }
  }, [teacher, setLocation]);

  const form = useForm<TeacherLogin>({
    resolver: zodResolver(teacherLoginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: TeacherLogin) {
    setIsLoading(true);
    try {
      const response = await apiRequest("POST", "/api/auth/teacher/login", values);
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: t.login.loggedIn,
          description: t.login.teacher.loggedInAs(data.teacher.fullName),
        });
        // Forget any student or parent this browser is remembering. The
        // server has already dropped those roles; this keeps the browser's
        // copy in step. Not logout(), which would destroy the new session.
        forgetRememberedLogins();
        setTeacher(data.teacher);
      } else {
        toast({
          title: t.login.loginFailed,
          description: data.message || t.login.student.invalidCredentials,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: t.login.loginFailed,
        description: t.login.teacher.tryAgain,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  if (teacher) {
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
            <CardTitle className="text-2xl">{t.login.teacher.title}</CardTitle>
            <CardDescription>
              {t.login.teacher.description}
            </CardDescription>
            {/* Shown when we sent the teacher here because their login had quietly
                ended — otherwise it just looks like the app logged them out. */}
            {window.location.search.includes("expired=1") && (
              <p className="mt-3 rounded-md bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-sm text-amber-800 dark:text-amber-200" data-testid="text-session-expired">
                {t.login.teacher.expired}
              </p>
            )}
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.login.teacher.emailLabel}</FormLabel>
                      <FormControl>
                        <Input 
                          type="email" 
                          placeholder={t.login.teacher.emailPlaceholder} 
                          data-testid="input-email"
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
                            placeholder={t.login.teacher.passwordPlaceholder} 
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
                      </CardContent>
        </Card>
      </main>
    </div>
  );
}
