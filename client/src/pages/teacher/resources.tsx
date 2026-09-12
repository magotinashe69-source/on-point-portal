import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { BulkPasteDialog } from "@/components/BulkPasteDialog";
import { splitPastedLines, separateDuplicates, type SkippedLine } from "@/lib/bulk-paste";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { QueryError } from "@/components/QueryError";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ThemeToggle } from "@/components/theme-toggle";
import { SimpleUploader } from "@/components/SimpleUploader";
import { 
  ArrowLeft, 
  PlusCircle, 
  BookOpen, 
  Video, 
  FileText, 
  File,
  Trash2,
  ExternalLink,
  Loader2,
  Download,
  Lock,
  ClipboardPaste
} from "lucide-react";
import type { Resource } from "@shared/schema";
import logoPath from "@assets/logo.webp";
import { serverMessage, SUBJECT_CODES, subjectName, useT } from "@/lib/i18n";

// Option lists shared by the single-resource form and the bulk paste dialog.
const RESOURCE_FORMS = ["Stage 3", "Stage 4", "Stage 5", "Stage 6", "Form 1", "Form 2"] as const;
const RESOURCE_TYPE_CODES = ["TEXTBOOK", "YOUTUBE", "LESSON_PLAN", "OTHER"] as const;

// --- Bulk paste ---------------------------------------------------------
// Adding a term's worth of links one dialog at a time is slow. Each line is one
// resource:
//
//   Grade 7 Maths Textbook | https://example.com/maths.pdf
//   Photosynthesis video | https://youtu.be/abc123 | Covers the light stage
//
// The type, subject and class are chosen once for the whole batch, and anything
// after a second separator becomes the description. The line splitting is
// shared with the other paste dialogs (see lib/bulk-paste).
export interface ParsedResourceLine {
  lineNumber: number;
  title: string;
  url: string;
  description: string;
}

export interface ParsedResources {
  rows: ParsedResourceLine[];
  skipped: SkippedLine[];
}

export function parsePastedResources(
  raw: string,
  reasons = { noTitle: "No title", noLink: 'No link — put it after a "|"' },
): ParsedResources {
  const rows: ParsedResourceLine[] = [];
  const skipped: SkippedLine[] = [];

  for (const line of splitPastedLines(raw)) {
    const title = line.parts[0] ?? "";
    const url = line.parts[1] ?? "";
    const description = line.parts.slice(2).join(" | ").trim();

    if (title === "") {
      skipped.push({ lineNumber: line.lineNumber, text: line.text, reason: reasons.noTitle });
      continue;
    }
    if (url === "") {
      skipped.push({ lineNumber: line.lineNumber, text: line.text, reason: reasons.noLink });
      continue;
    }
    rows.push({ lineNumber: line.lineNumber, title, url, description });
  }

  return { rows, skipped };
}

const createResourceSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  type: z.enum(["TEXTBOOK", "YOUTUBE", "LESSON_PLAN", "OTHER"]),
  url: z.string().optional(),
  fileUrl: z.string().optional(),
  subject: z.string().optional(),
  form: z.string().optional(),
  isTeacherOnly: z.boolean().default(false),
});

type CreateResourceForm = z.infer<typeof createResourceSchema>;

export default function TeacherResources() {
  const t = useT();
  const [, setLocation] = useLocation();
  const { teacher } = useAuth();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [filterForm, setFilterForm] = useState<string>("all");
  const [filterSubject, setFilterSubject] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");

  // Bulk paste: the dialog, the pasted list, and the settings applied to the
  // whole batch. `pasteBusy` blocks a second click while resources are going in.
  const [isPasteOpen, setIsPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteType, setPasteType] = useState<"TEXTBOOK" | "YOUTUBE" | "LESSON_PLAN" | "OTHER">("TEXTBOOK");
  const [pasteSubject, setPasteSubject] = useState<string>("");
  const [pasteForm, setPasteForm] = useState<string>("");
  const [pasteTeacherOnly, setPasteTeacherOnly] = useState(false);
  const [pasteBusy, setPasteBusy] = useState(false);


  useEffect(() => {
    if (!teacher) {
      setLocation("/teacher/login");
    }
  }, [teacher, setLocation]);

  const { data: resources, isLoading, isError, error, refetch } = useQuery<Resource[]>({
    queryKey: ["/api/resources", { teacherOnly: true }],
    enabled: !!teacher,
  });

  const form = useForm<CreateResourceForm>({
    resolver: zodResolver(createResourceSchema),
    defaultValues: {
      title: "",
      description: "",
      type: "TEXTBOOK",
      url: "",
      fileUrl: "",
      subject: "",
      form: "",
      isTeacherOnly: false,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateResourceForm) => {
      const response = await apiRequest("POST", "/api/resources", {
        ...data,
        createdById: teacher?.id,
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ["/api/resources"] });
        toast({ title: t.teacherLibrary.resourceAdded });
        setIsDialogOpen(false);
        form.reset();
      } else {
        toast({ title: t.teacherLibrary.resourceNotAdded, description: serverMessage(t, data), variant: "destructive" });
      }
    },
  });


  // Work out what a paste would actually do, so the preview and the button
  // agree with what happens. A link already on the shelf is skipped, and so is
  // the same link repeated twice in the pasted list itself.
  const pasteParsed = parsePastedResources(pasteText, { noTitle: t.teacherLibrary.noTitle, noLink: t.teacherLibrary.noLink });
  const pasteReview = separateDuplicates(pasteParsed.rows, {
    keyOf: r => r.url,
    labelOf: r => r.title,
    lineNumberOf: r => r.lineNumber,
    existingKeys: new Set(
      (resources || []).map(r => (r.url || "").trim().toLowerCase()).filter(u => u !== "")
    ),
    existingReason: t.teacherLibrary.alreadySaved,
  });

  // Add everything in the preview. Resources go in one at a time so that one
  // bad row cannot lose the rest; the toast says exactly what happened.
  const addPastedResources = async () => {
    const rows = pasteReview.toAdd;
    if (rows.length === 0 || pasteBusy) return;
    setPasteBusy(true);

    let added = 0;
    const failed: string[] = [];
    for (const row of rows) {
      try {
        const response = await apiRequest("POST", "/api/resources", {
          title: row.title,
          description: row.description || undefined,
          type: pasteType,
          url: row.url,
          subject: pasteSubject || undefined,
          form: pasteForm || undefined,
          isTeacherOnly: pasteTeacherOnly,
          createdById: teacher?.id,
        });
        const data = await response.json();
        if (data.success) added++;
        else failed.push(row.title);
      } catch {
        failed.push(row.title);
      }
    }

    queryClient.invalidateQueries({ queryKey: ["/api/resources"] });
    setPasteBusy(false);
    setIsPasteOpen(false);
    setPasteText("");

    const skippedCount = pasteReview.duplicates.length;
    toast({
      title: `Added ${added} resource${added === 1 ? "" : "s"}`,
      description: [
        skippedCount > 0 ? `${skippedCount} already saved or repeated — skipped.` : "",
        failed.length > 0 ? `Could not add: ${failed.join(", ")}.` : "",
      ].filter(Boolean).join(" ") || "Everything on the list was added.",
      variant: failed.length > 0 ? "destructive" : undefined,
    });
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/resources/${id}`);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ["/api/resources"] });
        toast({ title: t.teacherLibrary.resourceDeleted });
      } else {
        toast({ title: t.teacherLibrary.resourceNotDeleted, description: serverMessage(t, data), variant: "destructive" });
      }
    },
  });

  const filteredResources = resources?.filter(r => {
    if (filterForm !== "all" && r.form !== filterForm) return false;
    if (filterSubject !== "all" && r.subject !== filterSubject) return false;
    if (filterType !== "all" && r.type !== filterType) return false;
    return true;
  }) || [];

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "TEXTBOOK": return <BookOpen className="h-5 w-5" />;
      case "YOUTUBE": return <Video className="h-5 w-5" />;
      case "LESSON_PLAN": return <FileText className="h-5 w-5" />;
      default: return <File className="h-5 w-5" />;
    }
  };

  const getTypeBadgeVariant = (type: string) => {
    switch (type) {
      case "TEXTBOOK": return "default";
      case "YOUTUBE": return "secondary";
      case "LESSON_PLAN": return "outline";
      default: return "outline";
    }
  };

  if (!teacher) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
          <Link href="/teacher/dashboard" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">{t.submit.backToDashboard}</span>
          </Link>
          <div className="flex items-center gap-3">
            <img src={logoPath} alt="On Point" className="h-8 w-auto" />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">{t.teacherLibrary.resources}</h1>
            <p className="text-muted-foreground">{t.teacherLibrary.resourcesNote}</p>
          </div>
          <div className="flex items-center gap-2">
          {/* Bulk paste — add a whole list of links at once. */}
          <Button variant="outline" onClick={() => setIsPasteOpen(true)} data-testid="button-paste-resources">
            <ClipboardPaste className="h-4 w-4 mr-2" />
            {t.teacherLibrary.pasteResources}
          </Button>
          <BulkPasteDialog
            open={isPasteOpen}
            onOpenChange={setIsPasteOpen}
            title={t.teacherLibrary.pasteResources}
            description={t.teacherLibrary.pasteNote}
            noun={{ one: "resource", many: "resources" }}
            settings={
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>{t.teacherLibrary.type}</Label>
                    <Select value={pasteType} onValueChange={(v) => setPasteType(v as typeof pasteType)}>
                      <SelectTrigger data-testid="select-paste-type"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {RESOURCE_TYPE_CODES.map(code => <SelectItem key={code} value={code}>{t.teacherLibrary.types[code]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t.teacherLibrary.subject}</Label>
                    <Select value={pasteSubject || "__none__"} onValueChange={(v) => setPasteSubject(v === "__none__" ? "" : v)}>
                      <SelectTrigger data-testid="select-paste-subject"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">{t.teacherLibrary.noSubject}</SelectItem>
                        {SUBJECT_CODES.map(code => <SelectItem key={code} value={code}>{subjectName(t, code)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t.teacherLibrary.classLabel}</Label>
                    <Select value={pasteForm || "__all__"} onValueChange={(v) => setPasteForm(v === "__all__" ? "" : v)}>
                      <SelectTrigger data-testid="select-paste-class"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">{t.teacherLibrary.allClasses}</SelectItem>
                        {RESOURCE_FORMS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={pasteTeacherOnly}
                    onChange={(e) => setPasteTeacherOnly(e.target.checked)}
                    data-testid="checkbox-paste-teacher-only"
                  />
                  Teachers only — students will not see these
                </label>
              </div>
            }
            value={pasteText}
            onValueChange={setPasteText}
            placeholder={"Grade 7 Maths Textbook | https://example.com/maths.pdf\nPhotosynthesis video | https://youtu.be/abc123 | Covers the light stage"}
            hint="Anything after a second bar becomes the description."
            toAdd={pasteReview.toAdd}
            keyOfRow={(r) => r.lineNumber}
            renderRow={(r) => (
              <>
                {r.title}
                <div className="text-xs text-muted-foreground truncate">
                  {r.url}{r.description ? " — " + r.description : ""}
                </div>
              </>
            )}
            emptyMessage="Nothing new to add — every link here is already saved."
            duplicates={pasteReview.duplicates}
            skipped={pasteParsed.skipped}
            busy={pasteBusy}
            onConfirm={addPastedResources}
            testIds={{
              textarea: "textarea-paste-resources",
              preview: "paste-resources-preview",
              rowPrefix: "paste-resource-row-",
              duplicates: "paste-resources-duplicates",
              skipped: "paste-resources-skipped",
              confirm: "button-paste-resources-confirm",
              cancel: "button-paste-resources-cancel",
            }}
          />

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-resource">
                <PlusCircle className="h-4 w-4 mr-2" />
                Add resource
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t.teacherLibrary.addResource}</DialogTitle>
                <DialogDescription>{t.teacherLibrary.addResourceNote}</DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.teacherLibrary.title}</FormLabel>
                        <FormControl>
                          <Input placeholder={t.teacherLibrary.titlePlaceholder} data-testid="input-resource-title" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.teacherLibrary.type}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-resource-type">
                              <SelectValue placeholder={t.teacherLibrary.selectType} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="TEXTBOOK">Textbook</SelectItem>
                            <SelectItem value="YOUTUBE">YouTube Video</SelectItem>
                            <SelectItem value="LESSON_PLAN">Lesson Plan</SelectItem>
                            <SelectItem value="OTHER">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.teacherLibrary.description}</FormLabel>
                        <FormControl>
                          <Textarea placeholder={t.teacherLibrary.descriptionPlaceholder} data-testid="textarea-resource-desc" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="subject"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t.teacherLibrary.subject}</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ""}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t.teacherLibrary.selectSubject} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="MATHS">Maths</SelectItem>
                              <SelectItem value="ENGLISH">English</SelectItem>
                              <SelectItem value="SCIENCE">Science</SelectItem>
                              <SelectItem value="PHYSICS">Physics</SelectItem>
                              <SelectItem value="CHEMISTRY">Chemistry</SelectItem>
                              <SelectItem value="BIOLOGY">Biology</SelectItem>
                              <SelectItem value="ECONOMICS">Economics</SelectItem>
                              <SelectItem value="BUSINESS_STUDIES">Business Studies</SelectItem>
                              <SelectItem value="GEOGRAPHY">Geography</SelectItem>
                              <SelectItem value="COMPUTER_SCIENCE">Computer Science</SelectItem>
                              <SelectItem value="HISTORY">History</SelectItem>
                              <SelectItem value="ACCOUNTING">Accounting</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="form"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t.teacherLibrary.form}</FormLabel>
                          <Select onValueChange={(val) => field.onChange(val === "__all__" ? "" : val)} value={field.value || "__all__"}>
                            <FormControl>
                              <SelectTrigger data-testid="select-resource-form">
                                <SelectValue placeholder={t.teacherLibrary.allFormsOption} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="__all__">{t.teacherLibrary.allForms}</SelectItem>
                              <SelectItem value="Stage 3">Stage 3</SelectItem>
                              <SelectItem value="Stage 4">Stage 4</SelectItem>
                              <SelectItem value="Stage 5">Stage 5</SelectItem>
                              <SelectItem value="Stage 6">Stage 6</SelectItem>
                              <SelectItem value="Form 1">Form 1</SelectItem>
                              <SelectItem value="Form 2">Form 2</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {form.watch("type") === "YOUTUBE" ? (
                    <FormField
                      control={form.control}
                      name="url"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t.teacherLibrary.youtubeUrl}</FormLabel>
                          <FormControl>
                            <Input placeholder="https://youtube.com/watch?v=..." data-testid="input-resource-url" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : (
                    <FormField
                      control={form.control}
                      name="fileUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t.teacherLibrary.uploadFile}</FormLabel>
                          <div className="space-y-2">
                            <SimpleUploader
                              onUpload={(url) => field.onChange(url)}
                              accept=".pdf,.doc,.docx,image/*"
                              label={t.teacherLibrary.uploadDocument}
                            />
                            {field.value && (
                              <p className="text-sm text-muted-foreground">File uploaded: {field.value.split('/').pop()}</p>
                            )}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={form.control}
                    name="isTeacherOnly"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-md border p-3">
                        <div>
                          <FormLabel>{t.teacherLibrary.teacherOnly}</FormLabel>
                          <p className="text-xs text-muted-foreground">{t.teacherLibrary.teacherOnlyNote}</p>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                    {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Add resource
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4">
              <Select value={filterForm} onValueChange={setFilterForm}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder={t.register.filterByForm} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.teacherLibrary.allForms}</SelectItem>
                  <SelectItem value="Stage 3">Stage 3</SelectItem>
                  <SelectItem value="Stage 4">Stage 4</SelectItem>
                  <SelectItem value="Stage 5">Stage 5</SelectItem>
                  <SelectItem value="Stage 6">Stage 6</SelectItem>
                  <SelectItem value="Form 1">Form 1</SelectItem>
                  <SelectItem value="Form 2">Form 2</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterSubject} onValueChange={setFilterSubject}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={t.library.filterBySubject} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.library.allSubjects}</SelectItem>
                  <SelectItem value="MATHS">Maths</SelectItem>
                  <SelectItem value="ENGLISH">English</SelectItem>
                  <SelectItem value="SCIENCE">Science</SelectItem>
                  <SelectItem value="PHYSICS">Physics</SelectItem>
                  <SelectItem value="CHEMISTRY">Chemistry</SelectItem>
                  <SelectItem value="BIOLOGY">Biology</SelectItem>
                  <SelectItem value="ECONOMICS">Economics</SelectItem>
                  <SelectItem value="BUSINESS_STUDIES">Business Studies</SelectItem>
                  <SelectItem value="GEOGRAPHY">Geography</SelectItem>
                  <SelectItem value="COMPUTER_SCIENCE">Computer Science</SelectItem>
                  <SelectItem value="HISTORY">History</SelectItem>
                  <SelectItem value="ACCOUNTING">Accounting</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder={t.library.filterByType} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.library.allTypes}</SelectItem>
                  <SelectItem value="TEXTBOOK">{t.library.textbooks}</SelectItem>
                  <SelectItem value="YOUTUBE">{t.library.videos}</SelectItem>
                  <SelectItem value="LESSON_PLAN">{t.library.lessonPlans}</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <QueryError error={error} what={t.errors.thing.yourResources} onRetry={() => refetch()} data-testid="resources-load-error" />
        ) : filteredResources.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredResources.map((resource) => (
              <Card key={resource.id} className="overflow-hidden">
                <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-md bg-muted">
                      {getTypeIcon(resource.type)}
                    </div>
                    <div>
                      <CardTitle className="text-base">{resource.title}</CardTitle>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant={getTypeBadgeVariant(resource.type)}>{resource.type.replace('_', ' ')}</Badge>
                        {resource.isTeacherOnly && (
                          <Badge variant="outline" className="text-xs">
                            <Lock className="h-3 w-3 mr-1" />
                            Teachers Only
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMutation.mutate(resource.id)}
                    disabled={deleteMutation.isPending}
                    data-testid={`button-delete-resource-${resource.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </CardHeader>
                <CardContent>
                  {resource.description && (
                    <p className="text-sm text-muted-foreground mb-3">{resource.description}</p>
                  )}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3 flex-wrap">
                    {resource.subject && <span>{resource.subject}</span>}
                    {resource.subject && resource.form && <span>-</span>}
                    {resource.form && <span>{resource.form}</span>}
                  </div>
                  {resource.url && (
                    <a href={resource.url} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm" className="w-full">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Open link
                      </Button>
                    </a>
                  )}
                  {resource.fileUrl && (
                    <a href={`${resource.fileUrl}?download=${encodeURIComponent(resource.title)}`} download={resource.title}>
                      <Button variant="outline" size="sm" className="w-full">
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    </a>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">{t.teacherLibrary.noResources}</h3>
              <p className="text-muted-foreground mb-4">{t.teacherLibrary.noResourcesNote}</p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <PlusCircle className="h-4 w-4 mr-2" />
                Add resource
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
