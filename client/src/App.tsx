import { Switch, Route, Redirect } from "wouter";
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
import SubmissionReview from "@/pages/teacher/submission-review";
import TeacherExport from "@/pages/teacher/export";
import DailyReport from "@/pages/teacher/daily-report";
import StudentLogin from "@/pages/student/login";
import StudentDashboard from "@/pages/student/dashboard";
import SubmitAssignment from "@/pages/student/submit-assignment";
import ViewResults from "@/pages/student/view-results";
import StudentResources from "@/pages/student/resources";
import StudentLessons from "@/pages/student/lessons";
import TreasureIsland from "@/pages/student/treasure-island";
import PenaltyShootout from "@/pages/student/penalty-shootout";
// Dream World is retired. Its pages (dream-world, visit, town-view, certificate)
// are still in the repo but are no longer imported or routed to — see the
// redirects below.

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      {/* Placeholder pages for features that are not built yet. */}
      <Route path="/games">{() => <ComingSoon title="Games" message="Boss Battles and Quiz Battles are not ready yet." />}</Route>
      <Route path="/rewards">{() => <ComingSoon title="Rewards" message="Treasures and ranks are not ready yet." />}</Route>
      <Route path="/teacher/login" component={TeacherLogin} />
      <Route path="/teacher/dashboard" component={TeacherDashboard} />
      <Route path="/teacher/assignments/new" component={CreateAssignment} />
      <Route path="/teacher/assignments/:id/edit" component={CreateAssignment} />
      <Route path="/teacher/assignments/:id" component={AssignmentDetail} />
      <Route path="/teacher/mark/:id" component={MarkSubmission} />
      <Route path="/teacher/resources" component={TeacherResources} />
      <Route path="/teacher/lessons" component={TeacherLessons} />
      <Route path="/teacher/students" component={StudentManagement} />
      <Route path="/teacher/reports" component={TeacherReports} />
      <Route path="/teacher/gradebook" component={GradeBook} />
      <Route path="/teacher/submissions/:id" component={SubmissionReview} />
      <Route path="/teacher/export" component={TeacherExport} />
      <Route path="/teacher/daily-report" component={DailyReport} />
      <Route path="/student/login" component={StudentLogin} />
      <Route path="/student/dashboard" component={StudentDashboard} />
      <Route path="/student/submit/:id" component={SubmitAssignment} />
      <Route path="/student/results/:id" component={ViewResults} />
      <Route path="/student/resources" component={StudentResources} />
      <Route path="/student/lessons" component={StudentLessons} />
      <Route path="/student/treasure" component={TreasureIsland} />
      {/* Penalty Shootout is primary-only; the page itself sends Forms back to
          their dashboard, and every endpoint behind it refuses them too. */}
      <Route path="/student/penalty" component={PenaltyShootout} />
      {/* Dream World is retired. An old bookmark or a typed address lands back
          on the dashboard instead of opening a game we no longer run. Nothing
          has been deleted — the towns are all still saved. */}
      <Route path="/student/dream-world">{() => <Redirect to="/student/dashboard" />}</Route>
      <Route path="/student/visit">{() => <Redirect to="/student/dashboard" />}</Route>
      <Route path="/student/town/:id">{() => <Redirect to="/student/dashboard" />}</Route>
      <Route path="/student/certificate">{() => <Redirect to="/student/dashboard" />}</Route>
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
