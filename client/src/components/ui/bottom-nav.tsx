import { Link, useLocation } from "wouter";
import { Users, Shuffle, History, BarChart3, RefreshCw, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/players", icon: Users, label: "Players" },
  { href: "/generate", icon: Shuffle, label: "Generate" },
  { href: "/results", icon: History, label: "Results" },
  { href: "/stats", icon: BarChart3, label: "Stats" },
  { href: "/rotation", icon: RefreshCw, label: "Rotation" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export function BottomNav() {
  const [location] = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-t border-border/50 pb-safe-area-inset-bottom">
      <div className="flex justify-around items-center h-16 max-w-md mx-auto px-1">
        {NAV_ITEMS.map((item) => {
          const isActive = location === item.href;
          return (
            <Link 
              key={item.href} 
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center w-full h-full space-y-1 transition-all duration-200 active:scale-95 group",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className={cn(
                "p-1.5 rounded-xl transition-all duration-300",
                isActive ? "bg-primary/15" : "bg-transparent group-hover:bg-white/5"
              )}>
                <item.icon size={22} className={cn("transition-transform duration-200", isActive && "scale-110")} />
              </div>
              <span className="text-[10px] font-medium tracking-wide">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
