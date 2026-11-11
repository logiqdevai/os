import axios, { AxiosError } from "axios";
import { getAuthStoreState, isLoggedIn } from "@/stores/auth";
import { environments } from "@/config/environments";

const axiosInstance = axios.create({
    baseURL: environments.API_URL,
    headers: { "Content-Type": "application/json" },
});

axiosInstance.interceptors.request.use((config) => {
    const auth = getAuthStoreState();
    if (auth.access_token && isLoggedIn(auth)) {
        config.headers.Authorization = `Bearer ${auth.access_token}`;
        if (auth.organization_id) config.headers["X-Organization-Id"] = auth.organization_id;
    }
    return config;
});

axiosInstance.interceptors.response.use(
    (response) => response,
    (error: AxiosError<{ code?: string }>) => {
        const status = error.response?.status;
        const code = error.response?.data?.code;
        if (status === 401 && getAuthStoreState().access_token && !error.config?.url?.includes("/auth/email/")) {
            getAuthStoreState().clear();
            if (!window.location.pathname.startsWith("/auth")) {
                window.location.href = `/auth/sign-in?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
            }
        }
        if (status === 404 && code === "organization_not_found") {
            getAuthStoreState().setOrganization(null);
        }
        return Promise.reject(error);
    }
);

export default axiosInstance;
