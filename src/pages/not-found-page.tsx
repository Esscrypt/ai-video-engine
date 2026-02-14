import { Button } from "@/components/ui/button";
import { NavLink } from "@/components/nav-link";

export default function NotFoundPage() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">Page not found</h1>
      <p className="text-muted-foreground">The requested route does not exist in this app.</p>
      <Button asChild>
        <NavLink href="/">Back to home</NavLink>
      </Button>
    </div>
  );
}
