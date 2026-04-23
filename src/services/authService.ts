import { apiRequest } from "../lib/api";
import type { AllowedCourtOption } from "../lib/allowedCourts";

export type AuthUser = {
  id: string;
  externalUserId?: string | null;
  authProvider?: string;
  username?: string | null;
  email: string;
  name: string | null;
  hasAiAccess?: boolean;
  creditsRemaining?: number;
  subscriptionStatus?: string | null;
  allowedCourtIdsJson?: unknown;
  allowedCourtIds?: unknown;
  allowedCourts?: AllowedCourtOption[];
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
    }).then((response) => {
      console.log("[authService.me] raw response:", response);
      console.log("[authService.me] user:", response?.user);
      console.log("[authService.me] court fields:", {
        allowedCourts: response?.user?.allowedCourts,
        allowedCourtIdsJson: response?.user?.allowedCourtIdsJson,
        allowedCourtIds: response?.user?.allowedCourtIds,
      });
      return response;
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

