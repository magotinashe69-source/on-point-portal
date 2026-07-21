import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/lib/auth";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import ComingSoon from "@/pages/coming-soon";
import TeacherLogin from "@/pages/teacher/login";
import TeacherDashboard from "@/pages/teacher/dashboard";
import CreateAssignment from "@/pages/teacher/create-assignment";
import AssignmentDetail from "@/pages/teacher/assignment-detail";
import MarkSubmission from "@/pages/teacher/mark-submission";
import TeacherResources from "@/pages/teacher/resources";
import TeacherLessons from "@/pages/teacher/lessons";
import StudentManagement from "@/pages/teacher/students";
import TeacherReports from "@/pages/teacher/reports";
import GradeBook from "@/pages/teacher/gradebook";
import TeacherExport from "@/pages/teacher/export";
import DailyReport from "@/pages/teacher/daily-report";
import StudentLogin from "@/pages/student/login";
import StudentDashboard from "@/pages/student/dashboard";
import SubmitAssignment from "@/pages/student/submit-assignment";
import ViewResults from "@/pages/student/view-results";
import StudentResources from "@/pages/student/resources";
import StudentLessons from "@/pages/student/lessons";
import TreasureIsland from "@/pages/student/treasure-island";
import DreamWorld from "@/pages/student/dream-world";
import VisitTowns from "@/pages/student/visit";
import TownViewPage from "@/pages/student/town-view";
import Certificate from "@/pages/student/certificate";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      {/* Placeholder pages for features that are not built yet. */}
      <Route path="/games">{() => <ComingSoon title="Fun Games" emoji="🎮" message="Boss Battles and Quiz Battles are on the way!" />}</Route>
      <Route path="/rewards">{() => <ComingSoon title="Rewards" emoji="🏆" message="Collect treasures and climb the ranks — almost ready!" />}</Route>
      <Route path="/teacher/login" component={TeacherLogin} />
      <Route path="/teacher/dashboard" component={TeacherDashboard} />
      <Route path="/teacher/assignments/new" component={CreateAssignment} />
      <Route path="/teacher/assignments/:id" component={AssignmentDetail} />
      <Route path="/teacher/mark/:id" component={MarkSubmission} />
      <Route path="/teacher/resources" component={TeacherResources} />
      <Route path="/teacher/lessons" component={TeacherLessons} />
      <Route path="/teacher/students" component={StudentManagement} />
      <Route path="/teacher/reports" component={TeacherReports} />
      <Route path="/teacher/gradebook" component={GradeBook} />
      <Route path="/teacher/export" component={TeacherExport} />
      <Route path="/teacher/daily-report" component={DailyReport} />
      <Route path="/student/login" component={StudentLogin} />
      <Route path="/student/dashboard" component={StudentDashboard} />
      <Route path="/student/submit/:id" component={SubmitAssignment} />
      <Route path="/student/results/:id" component={ViewResults} />
      <Route path="/student/resources" component={StudentResources} />
      <Route path="/student/lessons" component={StudentLessons} />
      <Route path="/student/treasure" component={TreasureIsland} />
      <Route path="/student/dream-world" component={DreamWorld} />
      <Route path="/student/visit" component={VisitTowns} />
      <Route path="/student/town/:id" component={TownViewPage} />
      <Route path="/student/certificate" component={Certificate} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light">
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
