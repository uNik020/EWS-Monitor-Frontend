import React, { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type AuthContextType = {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem("ews_user");
    return raw ? JSON.parse(raw) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("ews_token"));
  const navigate = useNavigate();

  useEffect(() => {
    // Nothing for now
  }, []);

  const login = async (email: string, password: string) => {
    if (!email || !password) throw new Error("Email and password required");

    try {
      const res = await fetch("http://localhost:5000/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "Invalid login");

      const token = data.token;

      // placeholder user object
      const demoUser: User = {
        id: "u1",
        name: "Demo Credit Analyst",
        email,
        role: "credit_analyst",
      };

      localStorage.setItem("ews_token", token);
      localStorage.setItem("ews_user", JSON.stringify(demoUser));

      setToken(token);
      setUser(demoUser);

      navigate("/", { replace: true });
    } catch (err: any) {
      throw new Error(err.message);
    }
  };
  
  const logout = () => {
    localStorage.removeItem("ews_token");
    localStorage.removeItem("ews_user");
    setToken(null);
    setUser(null);
    navigate("/login", { replace: true });
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
