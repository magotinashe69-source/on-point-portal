import { createContext, useContext, useState, useEffect } from "react";
import type { Teacher, Student } from "@shared/schema";

type AuthContextType = {
  teacher: Teacher | null;
  student: Student | null;
  setTeacher: (teacher: Teacher | null) => void;
  setStudent: (student: Student | null) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [teacher, setTeacher] = useState<Teacher | null>(() => {
    const stored = localStorage.getItem("onpoint-teacher");
    return stored ? JSON.parse(stored) : null;
  });
  
  const [student, setStudent] = useState<Student | null>(() => {
    const stored = localStorage.getItem("onpoint-student");
    return stored ? JSON.parse(stored) : null;
  });

  useEffect(() => {
    if (teacher) {
      localStorage.setItem("onpoint-teacher", JSON.stringify(teacher));
    } else {
      localStorage.removeItem("onpoint-teacher");
    }
  }, [teacher]);

  useEffect(() => {
    if (student) {
      localStorage.setItem("onpoint-student", JSON.stringify(student));
    } else {
      localStorage.removeItem("onpoint-student");
    }
  }, [student]);

  // The browser remembers the teacher forever, but the real login is a session
  // on the server that can end (the server restarting is enough). When that
  // happens the app used to still look logged in while every teacher-only
  // request quietly failed — the Grade Book listed students but opening one
  // showed nothing. So on startup we ask the server whether the session is
  // still real, and if it isn't we forget the teacher and let the normal
  // "please log in" redirect happen.
  useEffect(() => {
    if (!teacher) return;
    let cancelled = false;
    fetch("/api/auth/teacher/me", { credentials: "include" })
      .then((res) => {
        if (!cancelled && res.status === 401) setTeacher(null);
      })
      .catch(() => {
        // Offline or the server is down — keep the remembered login rather than
        // logging the teacher out over a temporary network blip.
      });
    return () => { cancelled = true; };
    // Runs once on startup; later changes come from logging in or out.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The same check for a student. This matters most right now: students who
  // logged in before student sessions existed have a remembered student in
  // localStorage and no session cookie at all, so every request for their own
  // data would 401 while the app still looked logged in. Asking the server
  // once on startup turns that into a clean trip back to the login screen.
  useEffect(() => {
    if (!student) return;
    let cancelled = false;
    fetch("/api/auth/student/me", { credentials: "include" })
      .then((res) => {
        if (!cancelled && res.status === 401) setStudent(null);
      })
      .catch(() => {
        // Offline or the server is down — keep the remembered login rather
        // than logging a child out over a temporary network blip.
      });
    return () => { cancelled = true; };
    // Runs once on startup; later changes come from logging in or out.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = () => {
    // Destroy whichever server-side session exists (fire-and-forget).
    fetch("/api/auth/teacher/logout", { method: "POST" }).catch(() => {});
    fetch("/api/auth/student/logout", { method: "POST" }).catch(() => {});
    setTeacher(null);
    setStudent(null);
    localStorage.removeItem("onpoint-teacher");
    localStorage.removeItem("onpoint-student");
  };

  return (
    <AuthContext.Provider value={{ teacher, student, setTeacher, setStudent, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
