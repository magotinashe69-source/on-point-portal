import { createContext, useContext, useState, useEffect, useRef } from "react";
import type { Teacher, Student, Parent } from "@shared/schema";
import { queryClient } from "./queryClient";

type AuthContextType = {
  teacher: Teacher | null;
  student: Student | null;
  parent: Parent | null;
  setTeacher: (teacher: Teacher | null) => void;
  setStudent: (student: Student | null) => void;
  setParent: (parent: Parent | null) => void;
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

  const [parent, setParent] = useState<Parent | null>(() => {
    const stored = localStorage.getItem("onpoint-parent");
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

  useEffect(() => {
    if (parent) {
      localStorage.setItem("onpoint-parent", JSON.stringify(parent));
    } else {
      localStorage.removeItem("onpoint-parent");
    }
  }, [parent]);

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

  // The same startup check again for a parent. Without it a parent whose
  // server session has ended would sit on a dashboard whose every request
  // fails, instead of being sent cleanly back to the login page.
  useEffect(() => {
    if (!parent) return;
    let cancelled = false;
    fetch("/api/auth/parent/me", { credentials: "include" })
      .then((res) => {
        if (!cancelled && res.status === 401) setParent(null);
      })
      .catch(() => {
        // Offline or the server is down — keep the remembered login rather
        // than logging a parent out over a temporary network blip.
      });
    return () => { cancelled = true; };
    // Runs once on startup; later changes come from logging in or out.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Whoever is signed in at this moment, as one value we can compare against
  // the last one. "none" means nobody.
  const identityKey = teacher
    ? `teacher:${teacher.id}`
    : parent
      ? `parent:${parent.id}`
      : student
        ? `student:${student.id}`
        : "none";

  // Throw away every cached answer the moment the signed-in person changes.
  //
  // This matters most for parents. The parent addresses deliberately carry NO
  // pupil id — the server works out the child from the session — which is what
  // stops a parent asking for another family's child. But it also means two
  // different parents READ THE SAME CACHE KEY. Without this, logging out of one
  // parent and into another would show the previous family's marks and feedback
  // straight from the cache, and because queries are set to staleTime: Infinity
  // it would never correct itself.
  //
  // The server never sent that data to the wrong parent — the browser simply
  // kept it. Clearing here, rather than in each login page, means a login added
  // later is covered without anybody having to remember.
  const previousIdentity = useRef(identityKey);
  useEffect(() => {
    if (previousIdentity.current === identityKey) return;
    previousIdentity.current = identityKey;
    queryClient.clear();
  }, [identityKey]);

  const logout = () => {
    // Destroy whichever server-side session exists (fire-and-forget).
    fetch("/api/auth/teacher/logout", { method: "POST" }).catch(() => {});
    fetch("/api/auth/student/logout", { method: "POST" }).catch(() => {});
    fetch("/api/auth/parent/logout", { method: "POST" }).catch(() => {});
    setTeacher(null);
    setStudent(null);
    setParent(null);
    localStorage.removeItem("onpoint-teacher");
    localStorage.removeItem("onpoint-student");
    localStorage.removeItem("onpoint-parent");
  };

  return (
    <AuthContext.Provider value={{ teacher, student, parent, setTeacher, setStudent, setParent, logout }}>
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
