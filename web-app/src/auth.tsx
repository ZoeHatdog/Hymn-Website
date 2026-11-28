import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { currentSession, endSession, type DeskUser } from "./api";

type AuthContextValue = {
  user: DeskUser | null | undefined;
  setUser: (user: DeskUser | null) => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<DeskUser | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    currentSession()
      .then((session) => {
        if (!cancelled) setUser(session);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      setUser,
      signOut: async () => {
        try {
          await endSession();
        } finally {
          setUser(null);
        }
      },
    }),
    [user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return value;
}
