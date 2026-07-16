import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ThemeToggle } from "@/components/theme-toggle";
import { SimpleUploader } from "@/components/SimpleUploader";
import {
  ArrowLeft,
  PlusCircle,
  Video,
  Mic,
  Trash2,
  Loader2,
  Play,
  Square,
  Upload,
  Clock,
  BookOpen,
  Circle,
} from "lucide-react";
import type { Lesson } from "@shared/schema";
import logoPath from "@assets/logo.webp";

const createLessonSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  subject: z.enum(["MATHS", "ENGLISH", "SCIENCE", "PHYSICS", "CHEMISTRY", "BIOLOGY", "ECONOMICS", "BUSINESS_STUDIES", "GEOGRAPHY", "COMPUTER_SCIENCE", "HISTORY", "ACCOUNTING"]),
  form: z.string().min(1, "Form is required"),
  type: z.enum(["VIDEO", "AUDIO"]),
  fileUrl: z.string().min(1, "File is required"),
  duration: z.string().optional(),
});

type CreateLessonForm = z.infer<typeof createLessonSchema>;

function MediaRecorder_({ onRecordingComplete, type }: { onRecordingComplete: (blob: Blob, duration: string) => void; type: "VIDEO" | "AUDIO" }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const startRecording = useCallback(async () => {
    try {
      const constraints: MediaStreamConstraints = type === "VIDEO"
        ? { video: true, audio: true }
        : { audio: true };
      
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      setHasPermission(true);

      if (type === "VIDEO" && videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = mediaStream;
        videoPreviewRef.current.play();
      }

      const mimeType = type === "VIDEO" 
        ? (window.MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus") ? "video/webm;codecs=vp9,opus" : "video/webm")
        : (window.MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm");

      const recorder = new window.MediaRecorder(mediaStream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const duration = formatTime(recordingTime);
        onRecordingComplete(blob, duration);
        mediaStream.getTracks().forEach(track => track.stop());
        setStream(null);
        setRecordingTime(0);
      };

      recorder.start(1000);
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      setHasPermission(false);
      console.error("Failed to start recording:", err);
    }
  }, [type, onRecordingComplete, recordingTime]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
    setIsPaused(false);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, [stream]);

  return (
    <div className="space-y-4">
      {type === "VIDEO" && (
        <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
          <video
            ref={videoPreviewRef}
            muted
            playsInline
            className="w-full h-full object-cover"
          />
          {!isRecording && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <p className="text-white text-sm">Camera preview will appear here</p>
            </div>
          )}
        </div>
      )}

      {type === "AUDIO" && isRecording && (
        <div className="flex items-center justify-center p-8 bg-muted rounded-lg">
          <div className="flex items-center gap-3">
            <Circle className={`h-4 w-4 fill-red-500 text-red-500 ${isRecording ? 'animate-pulse' : ''}`} />
            <span className="text-2xl font-mono font-bold">{formatTime(recordingTime)}</span>
          </div>
        </div>
      )}

      {hasPermission === false && (
        <p className="text-sm text-destructive">
          Permission denied. Please allow {type === "VIDEO" ? "camera and microphone" : "microphone"} access in your browser settings.
        </p>
      )}

      <div className="flex items-center gap-3 justify-center">
        {!isRecording ? (
          <Button type="button" onClick={startRecording} variant="default" size="lg" data-testid="button-start-recording">
            <Circle className="h-5 w-5 fill-red-500 text-red-500 mr-2" />
            Start Recording
          </Button>
        ) : (
          <Button type="button" onClick={stopRecording} variant="destructive" size="lg" data-testid="button-stop-recording">
            <Square className="h-5 w-5 mr-2" />
            Stop Recording ({formatTime(recordingTime)})
          </Button>
        )}
      </div>
    </div>
  );
}

export default function TeacherLessons() {
  const [, setLocation] = useLocation();
  const { teacher } = useAuth();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [uploadMode, setUploadMode] = useState<"upload" | "record">("upload");
  const [filterForm, setFilterForm] = useState<string>("all");
  const [filterSubject, setFilterSubject] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedDuration, setRecordedDuration] = useState<string>("");
  const [isUploadingRecording, setIsUploadingRecording] = useState(false);

  useEffect(() => {
    if (!teacher) {
      setLocation("/teacher/login");
    }
  }, [teacher, setLocation]);

  const { data: lessons, isLoading } = useQuery<Lesson[]>({
    queryKey: ["/api/lessons"],
    enabled: !!teacher,
  });

  const form = useForm<CreateLessonForm>({
    resolver: zodResolver(createLessonSchema),
    defaultValues: {
      title: "",
      description: "",
      type: "VIDEO",
      fileUrl: "",
      duration: "",
      subject: undefined,
      form: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateLessonForm) => {
      const response = await apiRequest("POST", "/api/lessons", {
        ...data,
        createdById: teacher?.id,
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ["/api/lessons"] });
        toast({ title: "Lesson added successfully" });
        setIsDialogOpen(false);
        form.reset();
        setRecordedBlob(null);
        setRecordedDuration("");
      } else {
        toast({ title: "Error", description: data.message, variant: "destructive" });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/lessons/${id}`);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ["/api/lessons"] });
        toast({ title: "Lesson deleted" });
      }
    },
  });

  const handleRecordingComplete = useCallback(async (blob: Blob, duration: string) => {
    setRecordedBlob(blob);
    setRecordedDuration(duration);
    form.setValue("duration", duration);
    
    setIsUploadingRecording(true);
    try {
      const lessonType = form.getValues("type");
      const ext = lessonType === "VIDEO" ? "webm" : "webm";
      const fileName = `recording_${Date.now()}.${ext}`;
      const file = new File([blob], fileName, { type: blob.type });
      
      const response = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fileName,
          size: file.size,
          contentType: blob.type,
        }),
      });
      
      if (!response.ok) throw new Error("Failed to get upload URL");
      const { uploadURL, objectPath } = await response.json();
      
      const uploadRes = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": blob.type },
      });
      
      if (!uploadRes.ok) throw new Error("Failed to upload recording");
      
      form.setValue("fileUrl", objectPath);
      toast({ title: "Recording uploaded successfully" });
    } catch (err) {
      toast({ title: "Upload failed", description: "Please try again", variant: "destructive" });
    } finally {
      setIsUploadingRecording(false);
    }
  }, [form, toast]);

  const filteredLessons = lessons?.filter(l => {
    if (filterForm !== "all" && l.form !== filterForm) return false;
    if (filterSubject !== "all" && l.subject !== filterSubject) return false;
    if (filterType !== "all" && l.type !== filterType) return false;
    return true;
  }) || [];

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
            <h1 className="text-3xl font-bold">Video & Audio Lessons</h1>
            <p className="text-muted-foreground">Upload or record lessons for your students</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              form.reset();
              setRecordedBlob(null);
              setRecordedDuration("");
              setUploadMode("upload");
            }
          }}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-lesson">
                <PlusCircle className="h-4 w-4 mr-2" />
                Add Lesson
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Lesson</DialogTitle>
                <DialogDescription>Upload a video/audio file or record one directly</DialogDescription>
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
                          <Input placeholder="e.g., Introduction to Algebra" data-testid="input-lesson-title" {...field} />
                        </FormControl>
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
                          <Textarea placeholder="Brief description of the lesson..." data-testid="textarea-lesson-desc" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Type</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-lesson-type">
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="VIDEO">Video Lesson</SelectItem>
                              <SelectItem value="AUDIO">Audio Lesson</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

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
                  </div>

                  <FormField
                    control={form.control}
                    name="form"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Form</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select form" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
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

                  <div className="space-y-3">
                    <FormLabel>Lesson File</FormLabel>
                    <Tabs value={uploadMode} onValueChange={(v) => setUploadMode(v as "upload" | "record")}>
                      <TabsList className="w-full">
                        <TabsTrigger value="upload" className="flex-1" data-testid="tab-upload">
                          <Upload className="h-4 w-4 mr-2" />
                          Upload File
                        </TabsTrigger>
                        <TabsTrigger value="record" className="flex-1" data-testid="tab-record">
                          <Mic className="h-4 w-4 mr-2" />
                          Record
                        </TabsTrigger>
                      </TabsList>
                      <TabsContent value="upload" className="mt-3">
                        <FormField
                          control={form.control}
                          name="fileUrl"
                          render={({ field }) => (
                            <FormItem>
                              <div className="space-y-2">
                                <SimpleUploader
                                  onUpload={(url) => field.onChange(url)}
                                  accept="video/*,audio/*,.mp4,.mp3,.wav,.webm,.ogg,.m4a"
                                  label={`Upload ${form.getValues("type") === "VIDEO" ? "Video" : "Audio"}`}
                                />
                                {field.value && (
                                  <p className="text-sm text-green-600 dark:text-green-400">File uploaded successfully</p>
                                )}
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </TabsContent>
                      <TabsContent value="record" className="mt-3">
                        <MediaRecorder_
                          type={form.watch("type")}
                          onRecordingComplete={handleRecordingComplete}
                        />
                        {isUploadingRecording && (
                          <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Uploading recording...
                          </div>
                        )}
                        {recordedBlob && !isUploadingRecording && form.getValues("fileUrl") && (
                          <p className="text-sm text-green-600 dark:text-green-400 mt-3">Recording ready ({recordedDuration})</p>
                        )}
                      </TabsContent>
                    </Tabs>
                  </div>

                  <FormField
                    control={form.control}
                    name="duration"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Duration (optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., 15:30" data-testid="input-lesson-duration" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" className="w-full" disabled={createMutation.isPending || isUploadingRecording} data-testid="button-submit-lesson">
                    {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Add Lesson
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
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
                  <SelectItem value="VIDEO">Video</SelectItem>
                  <SelectItem value="AUDIO">Audio</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredLessons.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredLessons.map((lesson) => (
              <Card key={lesson.id} className="overflow-hidden" data-testid={`card-lesson-${lesson.id}`}>
                <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-md ${lesson.type === "VIDEO" ? "bg-blue-100 dark:bg-blue-900/30" : "bg-purple-100 dark:bg-purple-900/30"}`}>
                      {lesson.type === "VIDEO" ? <Video className="h-5 w-5 text-blue-600 dark:text-blue-400" /> : <Mic className="h-5 w-5 text-purple-600 dark:text-purple-400" />}
                    </div>
                    <div>
                      <CardTitle className="text-base">{lesson.title}</CardTitle>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant={lesson.type === "VIDEO" ? "default" : "secondary"}>
                          {lesson.type === "VIDEO" ? "Video" : "Audio"}
                        </Badge>
                        <Badge variant="outline">{lesson.subject?.replace("_", " ")}</Badge>
                        <Badge variant="outline">{lesson.form}</Badge>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMutation.mutate(lesson.id)}
                    disabled={deleteMutation.isPending}
                    data-testid={`button-delete-lesson-${lesson.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </CardHeader>
                <CardContent>
                  {lesson.description && (
                    <p className="text-sm text-muted-foreground mb-3">{lesson.description}</p>
                  )}
                  {lesson.duration && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
                      <Clock className="h-3 w-3" />
                      {lesson.duration}
                    </div>
                  )}
                  {lesson.type === "VIDEO" ? (
                    <video controls className="w-full rounded-md" preload="metadata" data-testid={`video-player-${lesson.id}`}>
                      <source src={lesson.fileUrl} />
                      Your browser does not support the video element.
                    </video>
                  ) : (
                    <audio controls className="w-full" preload="metadata" data-testid={`audio-player-${lesson.id}`}>
                      <source src={lesson.fileUrl} />
                      Your browser does not support the audio element.
                    </audio>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    Added {new Date(lesson.createdAt).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <Video className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No lessons yet</h3>
              <p className="text-muted-foreground mb-4">Upload or record your first video or audio lesson</p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <PlusCircle className="h-4 w-4 mr-2" />
                Add Lesson
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
