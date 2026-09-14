import { Link } from "wouter";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useT } from "@/lib/i18n";

// Shown to a regular teacher who reaches an administrators' screen — by typing
// its address, or from an old bookmark.
//
// This is NOT what keeps them out. The server refuses every request those
// screens make to anybody who is not an administrator (requireTeacherAdmin in
// server/routes.ts). All this does is spare them a screen full of buttons that
// would each be refused.
export function AdminOnly() {
  const t = useT();
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md" data-testid="admin-only">
        <CardContent className="py-10 text-center space-y-3">
          <div className="mx-auto w-fit rounded-full bg-amber-100 dark:bg-amber-900/30 p-3">
            <ShieldAlert className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>
          <h1 className="text-xl font-bold">{t.staff.adminOnlyTitle}</h1>
          <p className="text-sm text-muted-foreground">{t.staff.adminOnlyNote}</p>
          <Link href="/teacher/dashboard">
            <Button className="mt-2" data-testid="link-admin-only-dashboard">{t.common.dashboard}</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
