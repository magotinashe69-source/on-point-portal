import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, Users, BookOpen, Award, ArrowRight, CheckCircle } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import logoPath from "@assets/image_1769457206059.png";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-3">
            <img src={logoPath} alt="On Point Education Centre" className="h-10 w-auto" />
            <span className="text-lg font-semibold text-primary hidden sm:block">On Point Education Centre</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/student/login">
              <Button variant="outline" data-testid="link-student-login">Student Portal</Button>
            </Link>
            <Link href="/teacher/login">
              <Button data-testid="link-teacher-login">Teacher Portal</Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative py-20 lg:py-32">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-4xl text-center">
              <div className="mb-8 flex justify-center">
                <img src={logoPath} alt="On Point Education Centre" className="h-32 w-auto" />
              </div>
              <h1 className="mb-6 text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                Quality Beyond Measure
              </h1>
              <p className="mb-8 text-lg text-muted-foreground sm:text-xl max-w-2xl mx-auto">
                Welcome to On Point Education Centre's Homework & Learning Portal. 
                Empowering teachers and students with seamless assignment management and feedback.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center flex-wrap">
                <Link href="/student/login">
                  <Button size="lg" variant="outline" className="gap-2" data-testid="button-student-get-started">
                    <GraduationCap className="h-5 w-5" />
                    I'm a Student
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/teacher/login">
                  <Button size="lg" className="gap-2" data-testid="button-teacher-get-started">
                    <Users className="h-5 w-5" />
                    I'm a Teacher
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 bg-muted/30">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
            <div className="grid md:grid-cols-3 gap-8">
              <Card className="hover-elevate">
                <CardHeader className="text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                    <BookOpen className="h-8 w-8 text-primary" />
                  </div>
                  <CardTitle>Teachers Create</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-center">
                    Teachers create assignments with detailed questions, instructions, and set due dates for each stage and subject.
                  </CardDescription>
                </CardContent>
              </Card>

              <Card className="hover-elevate">
                <CardHeader className="text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary/10">
                    <GraduationCap className="h-8 w-8 text-secondary" />
                  </div>
                  <CardTitle>Students Submit</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-center">
                    Students view their assignments, answer questions, and submit their work before the deadline.
                  </CardDescription>
                </CardContent>
              </Card>

              <Card className="hover-elevate">
                <CardHeader className="text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                    <Award className="h-8 w-8 text-primary" />
                  </div>
                  <CardTitle>Teachers Mark</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-center">
                    Teachers review submissions, provide marks and detailed feedback that students can access instantly.
                  </CardDescription>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl font-bold mb-6">For Teachers</h2>
                <ul className="space-y-4">
                  {[
                    "Create assignments for all subjects including sciences and commerce",
                    "Set questions with individual mark allocations",
                    "View all student submissions in one place",
                    "Mark and provide detailed feedback",
                    "Track student progress across subjects",
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                      <span className="text-muted-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h2 className="text-3xl font-bold mb-6">For Students</h2>
                <ul className="space-y-4">
                  {[
                    "Access assignments for your stage level",
                    "Submit answers directly through the portal",
                    "View your marked assignments and feedback",
                    "Track your scores and improvement areas",
                    "Simple login with name and PIN",
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-secondary mt-0.5 shrink-0" />
                      <span className="text-muted-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <img src={logoPath} alt="On Point" className="h-8 w-auto" />
            <span className="font-semibold text-primary">On Point Education Centre</span>
          </div>
          <p className="text-sm text-muted-foreground">Quality Beyond Measure</p>
        </div>
      </footer>
    </div>
  );
}
