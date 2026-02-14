import { cn } from "@/lib/utils";
import { navigateToPath } from "@/lib/router";
import type { MouseEvent, ReactNode } from "react";

interface NavLinkProps {
  href: string;
  children: ReactNode;
  className?: string;
  onPrefetch?: () => void;
}

export const NavLink = ({ href, children, className, onPrefetch }: NavLinkProps) => {
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    event.preventDefault();
    navigateToPath(href);
  };

  return (
    <a
      href={href}
      onClick={onClick}
      onMouseEnter={onPrefetch}
      className={cn("transition-colors hover:text-foreground", className)}
    >
      {children}
    </a>
  );
};
