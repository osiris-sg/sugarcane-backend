import { cn } from "@/lib/utils";

export function MainContainer({ children, className }) {
  return (
    <div className={cn("flex flex-col min-h-screen", className)}>
      {children}
    </div>
  );
}

export function PageContent({ children, className }) {
  return (
    <div className={cn("flex-1 p-6", className)}>
      {children}
    </div>
  );
}
