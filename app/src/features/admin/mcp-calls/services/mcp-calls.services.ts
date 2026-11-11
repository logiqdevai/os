import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type { McpCall, McpCallList } from "../interfaces/mcp-calls.interfaces";

const R = ApiRoutes.admin.mcpCalls;

export const getMcpCalls = async (params: Record<string, unknown>): Promise<McpCallList> => (await axiosInstance.get(R.list, { params })).data;
export const confirmMcpCall = async (id: string): Promise<{ call: McpCall; result: unknown }> => (await axiosInstance.post(R.confirm(id))).data;
export const rejectMcpCall = async (id: string): Promise<McpCall> => (await axiosInstance.post(R.reject(id))).data;
