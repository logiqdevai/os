import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type FC, useState } from "react";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";

interface QueryProviderProps {
  children: React.ReactNode;
}

/**
 * Mutation feedback (Linear-style): success is shown by the UI itself (optimistic updates, "Saved" indicators),
 * never by a toast. Every failed mutation shows ONE error toast here, so components must not toast errors themselves.
 *
 * Per mutation, via `meta`:
 *   - `errorTitle`: toast title (default "Something went wrong"); the API message is the description.
 *   - `errorToast: false`: the component shows the error inline (form field errors, autosave status) instead.
 */
declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: { errorTitle?: string; errorToast?: boolean };
  }
}

const QueryProvider: FC<QueryProviderProps> = ({ children }) => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
          },
        },
        mutationCache: new MutationCache({
          onError: (error, _variables, _context, mutation) => {
            if (mutation.meta?.errorToast === false) return;
            toast({ variant: "destructive", title: mutation.meta?.errorTitle ?? "Something went wrong", description: getApiErrorMessage(error) });
          },
        }),
      })
  );
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

export default QueryProvider;
