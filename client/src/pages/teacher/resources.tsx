import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { QueryError, describeError } from "@/components/QueryError";
import logoPath from "@assets/logo.webp";

// Option lists shared by the single-resource form and the bulk paste dialog.
const RESOURCE_SUBJECTS: { value: string; label: string }[] = [
  { value: "MATHS", label: "Maths" }, { value: "ENGLISH", label: "English" },
  { value: "SCIENCE", label: "Science" }, { value: "PHYSICS", label: "Physics" },
  { value: "CHEMISTRY", label: "Chemistry" }, { value: "BIOLOGY", label: "Biology" },
  { value: "ECONOMICS", label: "Economics" }, { value: "BUSINESS_STUDIES", label: "Business Studies" },
  { value: "GEOGRAPHY", label: "Geography" }, { value: "COMPUTER_SCIENCE", label: "Computer Science" },
  { value: "HISTORY", label: "History" }, { value: "ACCOUNTING", label: "Accounting" },
];
const RESOURCE_FORMS = ["Stage 3", "Stage 4", "Stage 5", "Stage 6", "Form 1", "Form 2"] as const;
const RESOURCE_TYPES: { value: "TEXTBOOK" | "YOUTUBE" | "LESSON_PLAN" | "OTHER"; label: string }[] = [
  { value: "TEXTBOOK", label: "Textbook" }, { value: "YOUTUBE", label: "YouTube Video" },
  { value: "LESSON_PLAN", label: "Lesson Plan" }, { value: "OTHER", label: "Other" },
];

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

export function parsePastedResources(raw: string): ParsedResources {
  const rows: ParsedResourceLine[] = [];
  const skipped: SkippedLine[] = [];

  for (const line of splitPastedLines(raw)) {
    const title = line.parts[0] ?? "";
    const url = line.parts[1] ?? "";
    const description = line.parts.slice(2).join(" | ").trim();

    if (title === "") {
      skipped.push({ lineNumber: line.lineNumber, text: line.text, reason: "No title" });
      continue;
    }
    if (url === "") {
      skipped.push({ lineNumber: line.lineNumber, text: line.text, reason: 'No link — put it after a "|"' });
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
        toast({ title: "Resource added successfully" });
        setIsDialogOpen(false);
        form.reset();
      } else {
        toast({ title: "Error", description: data.message, variant: "destructive" });
      }
    },
    onError: (error) => {
      toast({ title: "Couldn't add resource", description: describeError(error, "the resource"), variant: "destructive" });
    },
  });


  // Work out what a paste would actually do, so the preview and the button
  // agree with what happens. A link already on the shelf is skipped, and so is
  // the same link repeated twice in the pasted list itself.
  const pasteParsed = parsePastedResources(pasteText);
  const pasteReview = separateDuplicates(pasteParsed.rows, {
    keyOf: r => r.url,
    labelOf: r => r.title,
    lineNumberOf: r => r.lineNumber,
    existingKeys: new Set(
      (resources || []).map(r => (r.url || "").trim().toLowerCase()).filter(u => u !== "")
    ),
    existingReason: "This link is already saved",
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
        toast({ title: "Resource deleted" });
      } else {
        toast({ title: "Error", description: data.message, variant: "destructive" });
      }
    },
    onError: (error) => {
      toast({ title: "Couldn't delete resource", description: describeError(error, "the resource"), variant: "destructive" });
    },
  });

  // See the note in teacher/lessons.tsx: an empty list and a list emptied by
  // filters are different situations and must not share one message.
  const allResources = resources || [];
  const resourceFiltersActive = filterForm !== "all" || filterSubject !== "all" || filterType !== "all";
  const clearResourceFilters = () => { setFilterForm("all"); setFilterSubject("all"); setFilterType("all"); };

  const filteredResources = allResources.filter(r => {
    if (filterForm !== "all" && r.form !== filterForm) return false;
    if (filterSubject !== "all" && r.subject !== filterSubject) return false;
    if (filterType !== "all" && r.type !== filterType) return false;
    return true;
  });

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
            <span className="text-sm">Back to Dashboard</span>
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
            <h1 className="text-3xl font-bold">Learning Resources</h1>
            <p className="text-muted-foreground">Manage textbooks, videos, and lesson plans</p>
          </div>
          <div className="flex items-center gap-2">
          {/* Bulk paste — add a whole list of links at once. */}
          <Button variant="outline" onClick={() => setIsPasteOpen(true)} data-testid="button-paste-resources">
            <ClipboardPaste className="h-4 w-4 mr-2" />
            Paste resources
          </Button>
          <BulkPasteDialog
            open={isPasteOpen}
            onOpenChange={setIsPasteOpen}
            title="Paste resources"
            description="One resource per line, with the link after a bar. They all share the type, subject and class you pick here. Links already saved are skipped."
            noun={{ one: "resource", many: "resources" }}
            settings={
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>Type</Label>
                    <Select value={pasteType} onValueChange={(v) => setPasteType(v as typeof pasteType)}>
                      <SelectTrigger data-testid="select-paste-type"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {RESOURCE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Subject</Label>
                    <Select value={pasteSubject || "__none__"} onValueChange={(v) => setPasteSubject(v === "__none__" ? "" : v)}>
                      <SelectTrigger data-testid="select-paste-subject"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">No subject</SelectItem>
                        {RESOURCE_SUBJECTS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Class</Label>
                    <Select value={pasteForm || "__all__"} onValueChange={(v) => setPasteForm(v === "__all__" ? "" : v)}>
                      <SelectTrigger data-testid="select-paste-class"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All classes</SelectItem>
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
                Add Resource
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Resource</DialogTitle>
                <DialogDescription>Add a textbook, video, or lesson plan for your students</DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Grade 7 Mathematics Textbook" data-testid="input-resource-title" {...field} />
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
                        <FormLabel>Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-resource-type">
                              <SelectValue placeholder="Select type" />
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
                        <FormLabel>Description (optional)</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Brief description..." data-testid="textarea-resource-desc" {...field} />
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
                          <FormLabel>Subject</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ""}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select subject" />
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
                          <FormLabel>Form</FormLabel>
                          <Select onValueChange={(val) => field.onChange(val === "__all__" ? "" : val)} value={field.value || "__all__"}>
                            <FormControl>
                              <SelectTrigger data-testid="select-resource-form">
                                <SelectValue placeholder="All forms" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="__all__">All Forms</SelectItem>
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
                          <FormLabel>YouTube URL</FormLabel>
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
                          <FormLabel>Upload File</FormLabel>
                          <div className="space-y-2">
                            <SimpleUploader
                              onUpload={(url) => field.onChange(url)}
                              accept=".pdf,.doc,.docx,image/*"
                              label="Upload Document"
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
                          <FormLabel>Teacher Only</FormLabel>
                          <p className="text-xs text-muted-foreground">Hide this resource from students</p>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                    {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Add Resource
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
                  <SelectValue placeholder="Filter by form" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Forms</SelectItem>
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
                  <SelectValue placeholder="Filter by subject" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects</SelectItem>
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
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="TEXTBOOK">Textbooks</SelectItem>
                  <SelectItem value="YOUTUBE">Videos</SelectItem>
                  <SelectItem value="LESSON_PLAN">Lesson Plans</SelectItem>
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
          <Card><CardContent className="p-0">
            <QueryError error={error} what="your resources" onRetry={() => refetch()} data-testid="resources-load-error" />
          </CardContent></Card>
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
                        Open Link
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
        ) : resourceFiltersActive && allResources.length > 0 ? (
          <Card>
            <CardContent className="py-12 text-center" data-testid="resources-no-match">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No resources match these filters</h3>
              <p className="text-muted-foreground mb-4">
                You have {allResources.length} resource{allResources.length === 1 ? "" : "s"} — none of them match this class, subject and type.
              </p>
              <Button variant="outline" onClick={clearResourceFilters} data-testid="button-clear-resource-filters">
                Clear filters
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No resources found</h3>
              <p className="text-muted-foreground mb-4">Add your first learning resource to get started</p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <PlusCircle className="h-4 w-4 mr-2" />
                Add Resource
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
