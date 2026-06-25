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

const API_BASE_URL = "http://localhost:8000";

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem("visionvar_user");
    const storedToken = localStorage.getItem("visionvar_token");
    
    if (storedUser && storedToken) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
      } catch (e) {
        console.error("Failed to parse stored user", e);
        localStorage.removeItem("visionvar_user");
        localStorage.removeItem("visionvar_token");
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Login failed");
      }

      // Store user and token
      const userData: User = {
        id: data.id,
        email: data.email,
        name: data.name,
        clubName: data.clubName,
        role: data.role,
        createdAt: data.createdAt,
      };

      setUser(userData);
      localStorage.setItem("visionvar_user", JSON.stringify(userData));
      localStorage.setItem("visionvar_token", data.token);
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: {
    email: string;
    name: string;
    clubName?: string;
    role: UserRole;
    password?: string;
  }) => {
    setIsLoading(true);
    try {
      if (!data.password) {
        throw new Error("Password is required for registration");
      }

      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          name: data.name,
          clubName: data.clubName,
          role: data.role,
        }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || "Registration failed");
      }

      // Store user and token
      const userData: User = {
        id: responseData.id,
        email: responseData.email,
        name: responseData.name,
        clubName: responseData.clubName,
        role: responseData.role,
        createdAt: responseData.createdAt,
      };

      setUser(userData);
      localStorage.setItem("visionvar_user", JSON.stringify(userData));
      localStorage.setItem("visionvar_token", responseData.token);
    } catch (error) {
      console.error("Registration error:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("visionvar_user");
    localStorage.removeItem("visionvar_token");
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
