import axios from "axios";
import { useAuthStore } from "./auth-store";
import type { AuthResponse } from "./auth";

const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL ?? "").trim();
const API_URL = API_BASE_URL
  ? `${API_BASE_URL.replace(/\/$/, "")}/api/v1`
  : "/api/v1";

export const http = axios.create({
  baseURL: API_URL,
  timeout: 10000,
});

const authClient = axios.create({
  baseURL: API_URL,
  timeout: 10000,
});

type RetryableRequestConfig = {
  _retry?: boolean;
};

http.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

function resetInvalidSession() {
  useAuthStore.getState().clearSession();

  if (typeof window !== "undefined") {
    const path = window.location.pathname;
    if (path.startsWith("/dashboard") || path.startsWith("/admin")) {
      window.location.replace("/");
    }
  }
}

async function refreshAccessToken() {
  const state = useAuthStore.getState();
  if (!state.refreshToken) {
    resetInvalidSession();
    return null;
  }

  const { data } = await authClient.post<AuthResponse>("/auth/refresh", {
    refreshToken: state.refreshToken,
  });

  const nextSession = {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    user: {
      userId: data.userId,
      username: data.username,
      roles: data.roles,
    },
  };

  state.setSession(nextSession);
  return nextSession.accessToken;
}

http.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const originalRequest = error.config as RetryableRequestConfig | undefined;
    const requestURL = String(error.config?.url ?? "");

    if (
      status !== 401 ||
      !originalRequest ||
      originalRequest._retry ||
      requestURL.includes("/auth/login") ||
      requestURL.includes("/auth/refresh")
    ) {
      if (status === 401 && requestURL.includes("/auth/refresh")) {
        resetInvalidSession();
      }
      return Promise.reject(error);
    }

    try {
      originalRequest._retry = true;
      refreshPromise ??= refreshAccessToken().finally(() => {
        refreshPromise = null;
      });

      const nextAccessToken = await refreshPromise;
      if (!nextAccessToken) {
        return Promise.reject(error);
      }

      error.config.headers = error.config.headers ?? {};
      error.config.headers.Authorization = `Bearer ${nextAccessToken}`;
      return http(error.config);
    } catch (refreshError) {
      resetInvalidSession();
      return Promise.reject(refreshError);
    }
  },
);

export function getAPIErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const responseMessage = error.response?.data?.message;
    if (typeof responseMessage === "string" && responseMessage.trim()) {
      return responseMessage;
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export type MailDeliveryDiagnosticPayload = {
  stage?: string;
  code?: string;
  hint?: string;
  retryable?: boolean;
  message?: string;
};

export function getMailDeliveryDiagnostic(error: unknown): MailDeliveryDiagnosticPayload | null {
  if (!axios.isAxiosError(error)) {
    return null;
  }

  const responseData = error.response?.data;
  if (!responseData || typeof responseData !== "object") {
    return null;
  }

  const payload: MailDeliveryDiagnosticPayload = {};
  if (typeof responseData.stage === "string" && responseData.stage.trim()) {
    payload.stage = responseData.stage.trim();
  }
  if (typeof responseData.code === "string" && responseData.code.trim()) {
    payload.code = responseData.code.trim().toLowerCase();
  }
  if (typeof responseData.hint === "string" && responseData.hint.trim()) {
    payload.hint = responseData.hint.trim();
  }
  if (typeof responseData.retryable === "boolean") {
    payload.retryable = responseData.retryable;
  }
  if (typeof responseData.message === "string" && responseData.message.trim()) {
    payload.message = responseData.message.trim();
  }

  return Object.keys(payload).length ? payload : null;
}

export function getMailDeliveryErrorMessage(error: unknown, fallback: string) {
  const message = getAPIErrorMessage(error, fallback);
  const diagnostic = getMailDeliveryDiagnostic(error);
  const responseCode = diagnostic?.code ?? "";
  const responseHint = diagnostic?.hint ?? "";

  if (responseCode || responseHint) {
    const suffix = responseHint ? ` ${responseHint}` : "";
    switch (responseCode) {
      case "connect_failed":
        return `${message}${suffix || "  Check the SMTP host, port, and network connectivity."}`;
      case "starttls_unavailable":
      case "tls_failed":
      case "tls_certificate_invalid":
        return `${message}${suffix || "  Check the transport mode and certificate configuration, or confirm the server supports STARTTLS / SMTPS."}`;
      case "auth_failed":
      case "auth_unavailable":
        return `${message}${suffix || "  Check the SMTP username and password, or confirm AUTH is enabled on the server."}`;
      case "sender_rejected":
        return `${message}${suffix || "  Confirm the sender address is allowed by this SMTP provider."}`;
      case "recipient_rejected":
        return `${message}${suffix || " TextRecipientText，Text。"}`;
      case "data_failed":
        return `${message}${suffix || "  Check message size limits, or try again later."}`;
      case "quit_failed":
        return `${message}${suffix || "  The message body may have been sent; check the inbox before retrying."}`;
      case "timeout":
        return `${message}${suffix || "  Check the network, firewall, or SMTP server response time."}`;
      default:
        return suffix ? `${message} ${responseHint}` : message;
    }
  }

  const normalized = message.toLowerCase();

  if (normalized.includes("mail delivery connect failed")) {
    return `${message}  Check the SMTP host, port, and network connectivity.`;
  }
  if (
    normalized.includes("mail delivery tls handshake failed") ||
    normalized.includes("starttls") ||
    normalized.includes("certificate")
  ) {
    return `${message}  Check the transport mode and certificate configuration, or confirm the server supports STARTTLS / SMTPS.`;
  }
  if (
    normalized.includes("mail delivery authentication failed") ||
    normalized.includes("advertise auth")
  ) {
    return `${message}  Check the SMTP username and password, or confirm AUTH is enabled on the server.`;
  }
  if (normalized.includes("mail delivery mail from failed")) {
    return `${message}  Confirm the sender address is allowed by this SMTP provider.`;
  }
  if (normalized.includes("mail delivery rcpt to failed")) {
    return `${message} TextRecipientText，Text。`;
  }
  if (normalized.includes("mail delivery data failed")) {
    return `${message}  Check message size limits, or try again later.`;
  }
  if (normalized.includes("mail delivery quit failed")) {
    return `${message}  The message body may have been sent; check the inbox before retrying.`;
  }
  if (normalized.includes("operation timed out")) {
    return `${message}  Check the network, firewall, or SMTP server response time.`;
  }

  return message;
}
