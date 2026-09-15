import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, Loader2, ShieldCheck, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { AdminOnly } from "@/components/AdminOnly";
import { QueryError } from "@/components/QueryError";
import { ThemeToggle } from "@/components/theme-toggle";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { apiErrorMessage } from "@/lib/api-error";
import { longDate, useT } from "@/lib/i18n";
import { formEnum, staffRoleOf, type StaffMember } from "@shared/schema";
import logoPath from "@assets/logo.webp";

// The Staff screen: teachers who have asked to join, and the classes each
// approved teacher is given.
//
// Administrators only. Every request this screen makes is refused by the server
// to anybody else (requireTeacherAdmin); a regular teacher who types the address
// is shown <AdminOnly /> instead of a screen of buttons that would all fail.
export default function StaffPage() {
  const t = useT();
  const [, setLocation] = useLocation();
  const { teacher } = useAuth();
  const { toast } = useToast();
  const isAdmin = !!teacher && staffRoleOf(teacher) === "teacher_admin";

  useEffect(() => {
    if (!teacher) setLocation("/teacher/login");
  }, [teacher, setLocation]);

  const { data, isLoading, isError, error, refetch } = useQuery<{ success: boolean; staff: StaffMember[] }>({
    queryKey: ["/api/staff"],
    enabled: isAdmin,
    staleTime: 0,
  });

  const decide = useMutation({
    mutationFn: async ({ member, decision }: { member: StaffMember; decision: "approve" | "reject" }) => {
      const res = await apiRequest("POST", `/api/staff/${member.id}/${decision}`);
      return res.json();
    },
    onSuccess: (_body, { member, decision }) => {
      toast({
        title: decision === "approve" ? t.staff.approvedToast(member.fullName) : t.staff.rejectedToast(member.fullName),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
    },
    onError: (err) => toast({ title: apiErrorMessage(err, t.staff.couldNotSave), variant: "destructive" }),
  });

  if (!teacher) return null;
  if (!isAdmin) return <AdminOnly />;

  const staff = data?.staff ?? [];
  const waiting = staff.filter((s) => s.approvalStatus === "pending");
  const approved = staff.filter((s) => s.approvalStatus === "approved");
  const rejected = staff.filter((s) => s.approvalStatus === "rejected");

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
          <Link href="/teacher/dashboard" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">{t.common.dashboard}</span>
          </Link>
          <div className="flex items-center gap-2">
            <img src={logoPath} alt="On Point" className="h-8 w-auto" />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-3xl space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">{t.staff.title}</h1>
          </div>
          <p className="text-sm text-muted-foreground">{t.staff.subtitle}</p>
        </div>

        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {t.common.loading}
          </div>
        )}

        {isError && (
          <QueryError error={error} what={t.errors.thing.theStaffList} onRetry={() => refetch()} data-testid="staff-load-error" />
        )}

        {data && (
          <>
            {/* Waiting first: it is what an administrator comes here to act on. */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  {t.staff.waiting}
                  <Badge variant={waiting.length ? "default" : "secondary"} data-testid="badge-waiting-count">
                    {waiting.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {waiting.length === 0 ? (
                  <p className="text-sm text-muted-foreground" data-testid="text-none-waiting">{t.staff.noneWaiting}</p>
                ) : (
                  waiting.map((member) => (
                    <div
                      key={member.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
                      data-testid={`row-pending-${member.id}`}
                    >
                      <div className="min-w-0">
                        <p className="font-medium">{member.fullName}</p>
                        <p className="text-sm text-muted-foreground break-all">{member.email}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.staff.requested(longDate(t, String(member.createdAt)))}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => decide.mutate({ member, decision: "approve" })}
                          disabled={decide.isPending}
                          data-testid={`button-approve-${member.id}`}
                        >
                          <Check className="h-4 w-4 mr-1" /> {t.staff.approve}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => decide.mutate({ member, decision: "reject" })}
                          disabled={decide.isPending}
                          data-testid={`button-reject-${member.id}`}
                        >
                          <X className="h-4 w-4 mr-1" /> {t.staff.reject}
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{t.staff.accounts}</CardTitle>
                <CardDescription>{t.staff.classesNote}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {approved.map((member) => (
                  <div key={member.id} className="rounded-md border p-3 space-y-3" data-testid={`row-staff-${member.id}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium">{member.fullName}</p>
                        <p className="text-sm text-muted-foreground break-all">{member.email}</p>
                      </div>
                      <Badge variant={member.staffRole === "teacher_admin" ? "default" : "secondary"}>
                        {member.staffRole === "teacher_admin" ? t.staff.administrator : t.staff.teacher}
                      </Badge>
                    </div>
                    <ClassPicker member={member} />
                  </div>
                ))}
              </CardContent>
            </Card>

            {rejected.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{t.staff.rejected}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {rejected.map((member) => (
                    <p key={member.id} className="text-sm text-muted-foreground" data-testid={`row-rejected-${member.id}`}>
                      {member.fullName} — {member.email}
                    </p>
                  ))}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  );
}

/**
 * The classes one teacher is given. Stored on their account; organisational for
 * now, so nothing a teacher can see is narrowed by it yet.
 */
function ClassPicker({ member }: { member: StaffMember }) {
  const t = useT();
  const { toast } = useToast();
  const [chosen, setChosen] = useState<string[]>(member.assignedClasses);
  const changed = chosen.join("|") !== member.assignedClasses.join("|");

  const save = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", `/api/staff/${member.id}/classes`, { classes: chosen });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t.staff.classesSaved(member.fullName) });
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
    },
    onError: (err) => toast({ title: apiErrorMessage(err, t.staff.couldNotSave), variant: "destructive" }),
  });

  // Kept in the school's own order, however they are ticked.
  const toggle = (cls: string, on: boolean) =>
    setChosen((prev) => formEnum.options.filter((c) => (c === cls ? on : prev.includes(c))));

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{t.staff.classes}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {formEnum.options.map((cls) => {
          const id = `class-${member.id}-${cls.replace(/\s+/g, "-")}`;
          return (
            <label key={cls} htmlFor={id} className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                id={id}
                checked={chosen.includes(cls)}
                onCheckedChange={(value) => toggle(cls, value === true)}
                data-testid={`checkbox-${id}`}
              />
              {cls}
            </label>
          );
        })}
      </div>
      <Button
        size="sm"
        variant="outline"
        disabled={!changed || save.isPending}
        onClick={() => save.mutate()}
        data-testid={`button-save-classes-${member.id}`}
      >
        {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        {t.staff.saveClasses}
      </Button>
    </div>
  );
}
