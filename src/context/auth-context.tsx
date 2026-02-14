import { apiRequest, ApiClientError } from "@/lib/api-client";
import type {
  ForgotPasswordRequest,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  ResetPasswordRequest,
  UserProfile,
} from "@viralvector/common/contracts";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

interface AuthContextValue {
  user: UserProfile | null;
  isLoading: boolean;
  login: (credentials: LoginRequest) => Promise<LoginResponse>;
  register: (payload: RegisterRequest) => Promise<void>;
  forgotPassword: (payload: ForgotPasswordRequest) => Promise<{ resetToken?: string }>;
  resetPassword: (payload: ResetPasswordRequest) => Promise<void>;
  verifyPasskeyLogin: (pendingLoginToken: string, response: Record<string, unknown>) => Promise<void>;
  getGoogleLoginUrl: (nextPath: string) => Promise<string>;
  getPasskeyRegistrationOptions: () => Promise<{ token: string; options: Record<string, unknown> }>;
  verifyPasskeyRegistration: (token: string, response: Record<string, unknown>) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const response = await apiRequest<{ user: UserProfile }>("/api/auth/me", {
        method: "GET",
        ignoreUnauthorized: true,
      });
      setUser(response.user);
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) {
        setUser(null);
        return;
      }
      throw error;
    }
  };

  useEffect(() => {
    const loadUserSession = async () => {
      try {
        await refreshUser();
      } finally {
        setIsLoading(false);
      }
    };

    void loadUserSession();
  }, []);

  const login = async (credentials: LoginRequest): Promise<LoginResponse> => {
    const loginResponse = await apiRequest<LoginResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    });

    if (loginResponse.user) {
      await refreshUser();
    }

    return loginResponse;
  };

  const register = async (payload: RegisterRequest) => {
    await apiRequest<{ user: UserProfile }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  };

  const forgotPassword = async (payload: ForgotPasswordRequest): Promise<{ resetToken?: string }> => {
    return await apiRequest<{ success: true; resetToken?: string }>("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  };

  const resetPassword = async (payload: ResetPasswordRequest) => {
    await apiRequest<{ success: true }>("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  };

  const verifyPasskeyLogin = async (pendingLoginToken: string, response: Record<string, unknown>) => {
    await apiRequest<{ user: UserProfile }>("/api/auth/passkey/login/verify", {
      method: "POST",
      body: JSON.stringify({
        pendingLoginToken,
        response,
      }),
    });
    await refreshUser();
  };

  const getGoogleLoginUrl = async (nextPath: string): Promise<string> => {
    const encodedNextPath = encodeURIComponent(nextPath);
    const response = await apiRequest<{ url: string }>(`/api/auth/google/start?next=${encodedNextPath}`, {
      method: "GET",
    });
    return response.url;
  };

  const getPasskeyRegistrationOptions = async (): Promise<{ token: string; options: Record<string, unknown> }> => {
    const optionsResponse = await apiRequest<{ token: string; options: Record<string, unknown> }>(
      "/api/auth/passkey/register/options",
      {
        method: "POST",
      },
    );
    return optionsResponse;
  };

  const verifyPasskeyRegistration = async (token: string, response: Record<string, unknown>) => {
    await apiRequest<{ success: true }>("/api/auth/passkey/register/verify", {
      method: "POST",
      body: JSON.stringify({
        token,
        response,
      }),
    });
  };

  const logout = async () => {
    await apiRequest<void>("/api/auth/logout", {
      method: "POST",
    });
    setUser(null);
  };

  const value = useMemo<AuthContextValue>(() => {
    return {
      user,
      isLoading,
      login,
      register,
      forgotPassword,
      resetPassword,
      verifyPasskeyLogin,
      getGoogleLoginUrl,
      getPasskeyRegistrationOptions,
      verifyPasskeyRegistration,
      logout,
      refreshUser,
    };
  }, [user, isLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const authContext = useContext(AuthContext);
  if (!authContext) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return authContext;
};
