import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { 
  ArrowLeft, 
  BookOpen, 
  Video, 
  FileText, 
  File,
  ExternalLink,
  Loader2,
  Download
} from "lucide-react";
import type { Resource } from "@shared/schema";
import logoPath from "@assets/image_1769457206059.png";

export default function StudentResources() {
  const [, setLocation] = useLocation();
  const { student } = useAuth();
  const [filterSubject, setFilterSubject] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");

  useEffect(() => {
    if (!student) {
      setLocation("/student/login");
    }
  }, [student, setLocation]);

  const { data: resources, isLoading } = useQuery<Resource[]>({
    queryKey: ["/api/resources", { form: student?.form }],
    enabled: !!student,
  });

  const filteredResources = resources?.filter(r => {
    if (r.isTeacherOnly) return false;
    if (r.form && r.form !== student?.form) return false;
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
          <h1 className="text-3xl font-bold">Learning Resources</h1>
          <p className="text-muted-foreground">Textbooks, videos, and study materials for {student.form}</p>
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
        ) : filteredResources.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredResources.map((resource) => (
              <Card key={resource.id} className="overflow-hidden hover-elevate">
                <CardHeader className="flex flex-row items-start gap-3 pb-2">
                  <div className="p-2 rounded-md bg-muted">
                    {getTypeIcon(resource.type)}
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-base">{resource.title}</CardTitle>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant={getTypeBadgeVariant(resource.type)}>{resource.type.replace('_', ' ')}</Badge>
                      {resource.subject && <Badge variant="outline">{resource.subject}</Badge>}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {resource.description && (
                    <p className="text-sm text-muted-foreground mb-3">{resource.description}</p>
                  )}
                  {resource.url && (
                    <a href={resource.url} target="_blank" rel="noopener noreferrer">
                      <Button variant="default" size="sm" className="w-full">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Watch Video
                      </Button>
                    </a>
                  )}
                  {resource.fileUrl && (
                    <a href={`${resource.fileUrl}?download=${encodeURIComponent(resource.title)}`} download={resource.title}>
                      <Button variant="default" size="sm" className="w-full" data-testid={`button-download-resource-${resource.id}`}>
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
              <h3 className="font-semibold mb-2">No resources available</h3>
              <p className="text-muted-foreground">Your teacher hasn't added any resources for your form yet.</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
