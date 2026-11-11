import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type { AuthResponse, InvitationPreview, Session, SignInDto, SignUpDto, UpdateProfileDto, UserSessionRow } from "../interfaces/session.interfaces";

export const signIn = async (dto: SignInDto): Promise<AuthResponse> => (await axiosInstance.post(ApiRoutes.auth.login, dto)).data;
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
export const updatePreferences = async (dto: { theme?: string }) => (await axiosInstance.patch(ApiRoutes.auth.preferences, dto)).data;
export const getMySessions = async (): Promise<UserSessionRow[]> => (await axiosInstance.get(ApiRoutes.auth.sessions)).data;
export const revokeMySession = async (id: string) => (await axiosInstance.delete(ApiRoutes.auth.session(id))).data;
