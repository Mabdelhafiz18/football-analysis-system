import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";

export type UserRole = "coach" | "referee" | "manager" | "academy_admin";

export interface User {
  id: string;
  email: string;
  name: string;
  clubName?: string;
  role: UserRole;
  createdAt: string;
  avatar?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    name: string;
    clubName?: string;
    role: UserRole;
    password?: string;
  }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem("visionvar_user");
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error("Failed to parse stored user", e);
        localStorage.removeItem("visionvar_user");
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, _password?: string) => {
    setIsLoading(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 800));
    
    // Mock user based on email or default
    const mockUser: User = {
      id: "1",
      email,
      name: email.split("@")[0] || "User",
      clubName: "Demo Football Club",
      role: "manager", // Default role for demo login
      createdAt: new Date().toISOString(),
    };
    
    setUser(mockUser);
    localStorage.setItem("visionvar_user", JSON.stringify(mockUser));
    setIsLoading(false);
  };

  const register = async (data: {
    email: string;
    name: string;
    clubName?: string;
    role: UserRole;
  }) => {
    setIsLoading(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 800));
    
    const newUser: User = {
      id: Math.random().toString(36).substr(2, 9),
      email: data.email,
      name: data.name,
      clubName: data.clubName,
      role: data.role,
      createdAt: new Date().toISOString(),
    };
    
    setUser(newUser);
    localStorage.setItem("visionvar_user", JSON.stringify(newUser));
    setIsLoading(false);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("visionvar_user");
  };

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
