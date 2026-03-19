import { API_BASE_URL } from "./auth/runtime";
import { getDemoSession } from "./auth/session";

export const DEV_SESSION = getDemoSession();

export { API_BASE_URL };
