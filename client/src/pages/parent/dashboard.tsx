import { useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogOut, Loader2, GraduationCap } from "lucide-react";
import logoPath from "@assets/logo.webp";

// What the server sends back about the child. Deliberately small: for now a
// parent sees their child's name and class and nothing else.
type Child = {
  id: number;
  fullName: string;
  form: string;
};

export default function ParentDashboard() {
  const [, setLocation] = useLocation();
  const { parent, logout } = useAuth();

  useEffect(() => {
    if (!parent) {
      setLocation("/parent/login");
    }
  }, [parent, setLocation]);

  // Note there is no id in this address. The server works out which child to
  // send from the parent's own account, so this page has no way to ask for
  // anybody else's child even if it wanted to.
  const { data, isLoading, isError } = useQuery<{ success: boolean; child: Child }>({
    queryKey: ["/api/parent/child"],
    enabled: !!parent,
  });

  if (!parent) return null;

  const child = data?.child;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-3">
            <img src={logoPath} alt="On Point" className="h-8 w-auto" />
            <span className="text-sm font-semibold hidden sm:inline">Parent Portal</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                logout();
                setLocation("/parent/login");
              }}
              data-testid="button-parent-logout"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Log out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold" data-testid="text-parent-welcome">
            Welcome, {parent.fullName}
          </h1>
          <p className="text-muted-foreground">Quality Beyond Measure</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              Your child
            </CardTitle>
            <CardDescription>
              This account is linked to one pupil, and shows only their information.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading…
              </div>
            )}

            {isError && (
              <p className="text-sm text-destructive" data-testid="text-parent-child-error">
                We could not load your child's details just now. Try again in a moment.
              </p>
            )}

            {child && (
              <div className="flex items-center justify-between flex-wrap gap-3">
                <p className="text-xl font-semibold" data-testid="text-child-name">
                  {child.fullName}
                </p>
                <Badge variant="outline" data-testid="badge-child-form">{child.form}</Badge>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-sm text-muted-foreground text-center mt-6">
          More about your child's homework and marks will appear here soon.
        </p>
      </main>
    </div>
  );
}
