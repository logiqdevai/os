import axios, { AxiosError } from "axios";
import { getAuthStoreState, isLoggedIn } from "@/stores/auth";
import { environments } from "@/config/environments";
import { isUserActive, startUserActivityTracking } from "@/lib/user-activity";

startUserActivityTracking();

const axiosInstance = axios.create({
    baseURL: environments.API_URL,
    headers: { "Content-Type": "application/json" },
});

axiosInstance.interceptors.request.use((config) => {
    const auth = getAuthStoreState();
    if (auth.access_token && isLoggedIn(auth)) {
        config.headers.Authorization = `Bearer ${auth.access_token}`;
        if (auth.organization_id) config.headers["X-Organization-Id"] = auth.organization_id;
        // Background requests do not reset the idle timeout (01 §73).
        config.headers["X-Client-Active"] = isUserActive() ? "1" : "0";
    }
    return config;
});

axiosInstance.interceptors.response.use(
    (response) => response,
    (error: AxiosError<{ code?: string }>) => {
        const status = error.response?.status;
        const code = error.response?.data?.code;
        if (status === 401 && getAuthStoreState().access_token && !error.config?.url?.includes("/auth/email/") && !error.config?.url?.includes("/auth/mfa/verify")) {
            getAuthStoreState().clear();
            if (!window.location.pathname.startsWith("/auth")) {
                const reason = code === "session_idle_timeout" ? "&reason=idle" : "";
                window.location.href = `/auth/sign-in?next=${encodeURIComponent(window.location.pathname + window.location.search)}${reason}`;
            }
        }
        // 01 §74: the organization requires MFA and this person has not set it up yet.
        if (status === 403 && code === "mfa_enrollment_required" && !window.location.pathname.startsWith("/mfa-setup")) {
            window.location.href = `/mfa-setup?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        }
        if (status === 404 && code === "organization_not_found") {
            getAuthStoreState().setOrganization(null);
        }
        return Promise.reject(error);
    }
);

export default axiosInstance;
