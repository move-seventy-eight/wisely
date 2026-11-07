import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { trackPageView, trackPageEvents } from "@/lib/analytics";

// Hook to automatically track page views
export const useAnalytics = () => {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Track page view on route change
    if (pathname) {
      const url = window.location.origin + pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '');
      trackPageView(url, document.title);
    }
  }, [pathname, searchParams]);

  return trackPageEvents;
};

// Hook for manual page view tracking with custom data
export const useManualAnalytics = () => {
  const pathname = usePathname();

  const trackFeatureUsage = (featureName: string) => {
    trackPageEvents.toolUsage(featureName);
  };

  return { trackFeatureUsage };
};
