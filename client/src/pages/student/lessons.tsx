import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  ArrowLeft,
  Video,
  Mic,
  Loader2,
  Clock,
  BookOpen,
} from "lucide-react";
import type { Lesson } from "@shared/schema";
import logoPath from "@assets/logo.webp";

export default function StudentLessons() {
  const [, setLocation] = useLocation();
  const { student } = useAuth();
  const [filterSubject, setFilterSubject] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");

  useEffect(() => {
    if (!student) {
      setLocation("/student/login");
    }
  }, [student, setLocation]);

  const { data: lessons, isLoading } = useQuery<Lesson[]>({
    queryKey: ["/api/lessons", { form: student?.form }],
    enabled: !!student,
  });

  const filteredLessons = lessons?.filter(l => {
    if (l.form !== student?.form) return false;
    if (filterSubject !== "all" && l.subject !== filterSubject) return false;
    if (filterType !== "all" && l.type !== filterType) return false;
    return true;
  }) || [];

  if (!student) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
          <Link href="/student/dashboard" className="flex items-center gap-2">
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
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Video & Audio Lessons</h1>
          <p className="text-muted-foreground">Watch and listen to lessons from your teachers for {student.form}</p>
        </div>

        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4">
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
          <div className="grid gap-6 md:grid-cols-2">
            {filteredLessons.map((lesson) => (
              <Card key={lesson.id} className="overflow-hidden" data-testid={`card-lesson-${lesson.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-md shrink-0 ${lesson.type === "VIDEO" ? "bg-blue-100 dark:bg-blue-900/30" : "bg-purple-100 dark:bg-purple-900/30"}`}>
                      {lesson.type === "VIDEO" ? <Video className="h-5 w-5 text-blue-600 dark:text-blue-400" /> : <Mic className="h-5 w-5 text-purple-600 dark:text-purple-400" />}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{lesson.title}</CardTitle>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant={lesson.type === "VIDEO" ? "default" : "secondary"}>
                          {lesson.type === "VIDEO" ? "Video" : "Audio"}
                        </Badge>
                        <Badge variant="outline">{lesson.subject?.replace("_", " ")}</Badge>
                        {lesson.duration && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {lesson.duration}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {lesson.description && (
                    <p className="text-sm text-muted-foreground mb-4">{lesson.description}</p>
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
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <Video className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No lessons available</h3>
              <p className="text-muted-foreground">Your teacher hasn't added any video or audio lessons for {student.form} yet.</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
