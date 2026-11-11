import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type { TimeEntry } from "@/features/time/entries/interfaces/time-entries.interfaces";
import type { RunningTimer, StartTimerDto } from "../interfaces/timers.interfaces";

const R = ApiRoutes.time.timers;

export const getCurrentTimer = async (): Promise<{ timer: RunningTimer | null }> => (await axiosInstance.get(R.current)).data;
export const startTimer = async (dto: StartTimerDto): Promise<RunningTimer> => (await axiosInstance.post(R.start, dto)).data;
export const updateTimer = async ({ id, ...dto }: Omit<StartTimerDto, "stop_current"> & { id: string }): Promise<RunningTimer> => (await axiosInstance.patch(R.detail(id), dto)).data;
export const stopTimer = async (id: string): Promise<{ entry: TimeEntry }> => (await axiosInstance.post(R.stop(id))).data;
export const pauseTimer = async (id: string): Promise<RunningTimer> => (await axiosInstance.post(R.pause(id))).data;
export const resumeTimer = async (id: string): Promise<RunningTimer> => (await axiosInstance.post(R.resume(id))).data;
export const discardTimer = async (id: string) => (await axiosInstance.post(R.discard(id))).data;
