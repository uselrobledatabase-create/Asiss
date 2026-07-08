import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';
import { ToastContainer } from '../../shared/components/common/ToastContainer';
import { SupabaseHealthBanner } from '../../shared/components/common/SupabaseHealthBanner';

interface Props {
  children: ReactNode;
}

export const AppProviders = ({ children }: Props) => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            staleTime: 1000 * 60,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SupabaseHealthBanner />
      {children}
      <ToastContainer />
    </QueryClientProvider>
  );
};
