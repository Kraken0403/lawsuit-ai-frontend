import { apiRequest } from "../lib/api";

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
};

type AuthResponse = {
  ok: boolean;
  user: AuthUser;
};

export const authService = {
  me() {
    return apiRequest<AuthResponse>("/api/auth/me", {
      method: "GET",
    });
  },

  register(input: { email: string; password: string; name?: string }) {
    return apiRequest<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: input,
    });
  },

  login(input: { email: string; password: string }) {
    return apiRequest<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: input,
    });
  },

  logout() {
    return apiRequest<{ ok: boolean }>("/api/auth/logout", {
      method: "POST",
    });
  },
};