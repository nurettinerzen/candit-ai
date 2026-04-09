import { API_BASE_URL } from "../auth/runtime";

/**
 * Public API client for unauthenticated endpoints (candidate scheduling, etc.)
 */
function buildUrl(path: string, query?: Record<string, string | undefined>) {
  const base = API_BASE_URL.endsWith("/") ? API_BASE_URL : `${API_BASE_URL}/`;
  const url = new URL(path.replace(/^\//, ""), base);

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });
  }

  return url.toString();
}

async function publicRequest<T>(path: string, options: { method?: string; body?: unknown; query?: Record<string, string | undefined> } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  const body = options.body ? JSON.stringify(options.body) : undefined;

  const response = await fetch(buildUrl(path, options.query), {
    method: options.method ?? "GET",
    headers,
    body,
    cache: "no-store"
  });

  if (!response.ok) {
    let payload: unknown;
    try { payload = await response.json(); } catch { payload = undefined; }
    const message = payload && typeof payload === "object" && "message" in payload
      ? String((payload as { message?: unknown }).message)
      : `HTTP ${response.status}`;
    throw new Error(message);
  }

  return (await response.json()) as T;
}

export type PublicSchedulingWorkflow = {
  workflowId: string;
  state: string;
  status: string;
  proposedSlots: Array<{ slotId: string; start: string; end: string; source?: string }>;
  selectedSlot: Record<string, unknown> | null;
  bookingResult: Record<string, unknown> | null;
  application: { candidateName: string; jobTitle: string } | null;
};

export type PublicSlotBookResult = {
  workflowId: string;
  state: string;
  status: string;
  bookingResult: Record<string, unknown>;
  selectedSlot: Record<string, unknown>;
};

export type PublicContactSubmissionPayload = {
  fullName: string;
  email: string;
  company?: string;
  role?: string;
  phone?: string;
  message: string;
  sourcePage?: string;
  landingUrl?: string;
  referrerUrl?: string;
  locale?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  website?: string;
};

export const publicSchedulingApi = {
  getWorkflow(workflowId: string, token: string) {
    return publicRequest<PublicSchedulingWorkflow>(`scheduling/public/workflows/${workflowId}`, {
      query: { token }
    });
  },

  selectSlot(workflowId: string, token: string, slotId: string) {
    return publicRequest<PublicSlotBookResult>(`scheduling/public/workflows/${workflowId}/select-slot`, {
      method: "POST",
      query: { token },
      body: { slotId }
    });
  },

  getConfirmation(workflowId: string, token: string) {
    return publicRequest<PublicSchedulingWorkflow>(`scheduling/public/workflows/${workflowId}/confirmation`, {
      query: { token }
    });
  }
};

export const publicContactApi = {
  submit(payload: PublicContactSubmissionPayload) {
    return publicRequest<{
      success: true;
      id?: string;
      deduplicated: boolean;
      ignored?: boolean;
      message: string;
    }>("public/contact", {
      method: "POST",
      body: payload
    });
  }
};
