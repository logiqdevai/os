import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type { Appearance } from "@/hooks/use-theme";
import type { AuthResponse, InvitationPreview, MfaFactorDto, MfaStatus, MfaVerifyDto, Session, SignInDto, SignInResult, SignUpDto, TotpSetup, UpdateProfileDto, UserSessionRow } from "../interfaces/session.interfaces";

export const signIn = async (dto: SignInDto): Promise<SignInResult> => (await axiosInstance.post(ApiRoutes.auth.login, dto)).data;
export const verifyMfa = async (dto: MfaVerifyDto): Promise<AuthResponse> => (await axiosInstance.post(ApiRoutes.auth.mfa.verify, dto)).data;
export const signUp = async (dto: SignUpDto): Promise<AuthResponse> => (await axiosInstance.post(ApiRoutes.auth.register, dto)).data;
export const forgotPassword = async (email: string) => (await axiosInstance.post(ApiRoutes.auth.forgot_password, { email })).data;
export const resetPassword = async (dto: { token: string; password: string }) => (await axiosInstance.post(ApiRoutes.auth.reset_password, dto)).data;
export const getSession = async (): Promise<Session> => (await axiosInstance.get(ApiRoutes.auth.me)).data;
export const logout = async () => (await axiosInstance.post(ApiRoutes.auth.logout)).data;
export const switchOrganization = async (id: string): Promise<Session> => (await axiosInstance.post(ApiRoutes.auth.switch_organization(id))).data;
export const createOrganization = async (name: string): Promise<Session> => (await axiosInstance.post(ApiRoutes.auth.organizations, { name })).data;
export const getInvitation = async (token: string): Promise<InvitationPreview> => (await axiosInstance.get(ApiRoutes.auth.invitation(token))).data;
export const acceptInvitation = async (token: string) => (await axiosInstance.post(ApiRoutes.auth.accept_invitation, { token })).data;
export const updateProfile = async (dto: UpdateProfileDto) => (await axiosInstance.patch(ApiRoutes.auth.me, dto)).data;
export const changePassword = async (dto: { current_password: string; new_password: string }) => (await axiosInstance.post(ApiRoutes.auth.password, dto)).data;
export const uploadProfilePhoto = async (file: File): Promise<{ profile_photo_url: string }> => {
    const form = new FormData();
    form.append("file", file);
    return (await axiosInstance.post(ApiRoutes.auth.photo, form, { headers: { "Content-Type": "multipart/form-data" } })).data;
};
export const removeProfilePhoto = async (): Promise<{ profile_photo_url: null }> => (await axiosInstance.delete(ApiRoutes.auth.photo)).data;
/** `organization_id` is the session's active organization; sent explicitly because the stored switcher choice can be empty (the API then falls back to the default organization). */
export const updateAppearance = async ({ organization_id, ...dto }: Partial<Appearance> & { organization_id?: string | null }): Promise<Session["appearance"]> =>
    (await axiosInstance.patch(ApiRoutes.auth.appearance, dto, organization_id ? { headers: { "X-Organization-Id": organization_id } } : undefined)).data;
export const getMySessions = async (): Promise<UserSessionRow[]> => (await axiosInstance.get(ApiRoutes.auth.sessions)).data;
export const revokeMySession = async (id: string) => (await axiosInstance.delete(ApiRoutes.auth.session(id))).data;

export const getMfaStatus = async (): Promise<MfaStatus> => (await axiosInstance.get(ApiRoutes.auth.mfa.status)).data;
export const startTotpSetup = async (): Promise<TotpSetup> => (await axiosInstance.post(ApiRoutes.auth.mfa.totp_setup)).data;
export const confirmTotpSetup = async (code: string): Promise<{ enabled: true; recovery_codes: string[] }> => (await axiosInstance.post(ApiRoutes.auth.mfa.totp_confirm, { code })).data;
export const regenerateRecoveryCodes = async (dto: MfaFactorDto): Promise<{ recovery_codes: string[] }> => (await axiosInstance.post(ApiRoutes.auth.mfa.recovery_codes, dto)).data;
export const disableMfa = async (dto: MfaFactorDto): Promise<{ enabled: false }> => (await axiosInstance.post(ApiRoutes.auth.mfa.disable, dto)).data;
