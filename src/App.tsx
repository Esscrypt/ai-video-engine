import { AppShell } from "@/components/app-shell";
import { AuthProvider, useAuth } from "@/context/auth-context";
import { navigateToPath, usePathname } from "@/lib/router";
import "./index.css";
import { lazy, Suspense, useMemo } from "react";
import type { ComponentType, LazyExoticComponent } from "react";
import LoadingPage from "@/pages/loading-page";

interface RouteDefinition {
  loader: () => Promise<{ default: ComponentType<any> }>;
  requiresAuth?: boolean;
}

const routeDefinitions: Record<string, RouteDefinition> = {
  "/": { loader: () => import("@/pages/home-page") },
  "/pricing": { loader: () => import("@/pages/pricing-page") },
  "/docs": { loader: () => import("@/pages/docs-page") },
  "/login": { loader: () => import("@/pages/login-page") },
  "/register": { loader: () => import("@/pages/register-page") },
  "/forgot-password": { loader: () => import("@/pages/forgot-password-page") },
  "/dashboard": { loader: () => import("@/pages/dashboard-home-page"), requiresAuth: true },
  "/dashboard/api-keys": { loader: () => import("@/pages/api-keys-page"), requiresAuth: true },
  "/dashboard/videos": { loader: () => import("@/pages/reference-videos-page"), requiresAuth: true },
};

const notFoundLoader = () => import("@/pages/not-found-page");
const routeComponentCache = new Map<string, LazyExoticComponent<ComponentType<any>>>();

const getLazyPage = (pathname: string): LazyExoticComponent<ComponentType<any>> => {
  const existingComponent = routeComponentCache.get(pathname);
  if (existingComponent) {
    return existingComponent;
  }

  const routeDefinition = routeDefinitions[pathname];
  const lazyPage = lazy(routeDefinition ? routeDefinition.loader : notFoundLoader);
  routeComponentCache.set(pathname, lazyPage);
  return lazyPage;
};

const AppContent = () => {
  const pathname = usePathname();
  const { user, isLoading } = useAuth();
  const currentRoute = routeDefinitions[pathname];
  const PageComponent = useMemo(() => getLazyPage(pathname), [pathname]);

  if (!isLoading && currentRoute?.requiresAuth && !user) {
    const redirectPath = encodeURIComponent(pathname);
    navigateToPath(`/login?next=${redirectPath}`);
    return <LoadingPage />;
  }

  const prefetchRoute = (routePathname: string) => {
    const routeDefinition = routeDefinitions[routePathname];
    if (!routeDefinition) {
      return;
    }
    void routeDefinition.loader();
  };

  return (
    <AppShell pathname={pathname} prefetchRoute={prefetchRoute}>
      <Suspense fallback={<LoadingPage />}>
        <PageComponent pathname={pathname} />
      </Suspense>
    </AppShell>
  );
};

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
