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

  const logout = () => {
    // Destroy server-side teacher session (fire-and-forget; best-effort)
    fetch("/api/auth/teacher/logout", { method: "POST" }).catch(() => {});
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
