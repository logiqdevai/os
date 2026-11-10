import Navbar from "@/components/layout/navbar";
import { environments } from "@/config/environments";
import { Outlet } from "react-router-dom";

export default function AuthLayout() {
  return (
    <div className="h-full flex flex-col">
      <Navbar />
      <main className="flex-1 flex justify-center p-4 pt-8 sm:pt-12 overflow-y-auto">
        <div className="w-full max-w-md space-y-6">
          <div className="flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 h-6 w-6">
              <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" />
            </svg>
            <h2 className="text-xl font-medium">{environments.APP_NAME}</h2>
          </div>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
