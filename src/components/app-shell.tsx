import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { navigateToPath } from "@/lib/router";
import { cn } from "@/lib/utils";
import { NavLink } from "./nav-link";
import type { ReactNode } from "react";

interface AppShellProps {
  children: ReactNode;
  pathname: string;
  prefetchRoute: (pathname: string) => void;
}

const publicLinks = [
  { href: "/", label: "Home" },
  { href: "/pricing", label: "Pricing" },
  { href: "/docs", label: "Docs" },
];

const dashboardLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/api-keys", label: "API Keys" },
  { href: "/dashboard/videos", label: "Reference Videos" },
];

export const AppShell = ({ children, pathname, prefetchRoute }: AppShellProps) => {
  const { user, logout } = useAuth();

  const navLinks = user ? [...publicLinks, ...dashboardLinks] : publicLinks;

  const onLogout = async () => {
    await logout();
    navigateToPath("/");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <button
            type="button"
            onClick={() => navigateToPath("/")}
            className="font-semibold tracking-tight hover:text-primary"
          >
            ViralVector
          </button>

          <nav className="hidden items-center gap-5 text-sm text-muted-foreground md:flex">
            {navLinks.map(link => (
              <NavLink
                key={link.href}
                href={link.href}
                onPrefetch={() => prefetchRoute(link.href)}
                className={cn(pathname === link.href && "text-foreground")}
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {user ? (
              <>
                <span className="hidden text-sm text-muted-foreground sm:inline">
                  {user.email} - {user.apiCredits} credits
                </span>
                <Button variant="outline" size="sm" onClick={onLogout}>
                  Log out
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => navigateToPath("/register")}>
                  Register
                </Button>
                <Button variant="default" size="sm" onClick={() => navigateToPath("/login")}>
                  Sign in
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
};
