import { Link, useLocation } from "wouter";
import { Users, Shuffle, History, BarChart3, RefreshCw, Settings, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/context/AppContext";

const BASE_NAV_ITEMS = [
  { href: "/players", icon: Users, label: "Players" },
  { href: "/generate", icon: Shuffle, label: "Generate" },
  { href: "/results", icon: History, label: "Results" },
  { href: "/stats", icon: BarChart3, label: "Stats" },
  { href: "/rotation", icon: RefreshCw, label: "Rotation" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

const TOURNAMENT_NAV_ITEM = { href: "/tournament", icon: Trophy, label: "Tournament" };

export function BottomNav() {
  const [location] = useLocation();
  const { generationWorkspace } = useApp();
  const tournamentActive = generationWorkspace?.tournament?.active === true;

  const navItems = tournamentActive
    ? [...BASE_NAV_ITEMS.slice(0, 3), TOURNAMENT_NAV_ITEM, ...BASE_NAV_ITEMS.slice(3)]
    : BASE_NAV_ITEMS;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-t border-border/50"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 8px)" }}
    >
      <div className="flex justify-around items-center h-16 max-w-md mx-auto px-1">
        {navItems.map((item) => {
          const isActive = location === item.href;
          const isTournament = item.href === "/tournament";
          return (
            <Link 
              key={item.href} 
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center w-full h-full space-y-1 transition-all duration-200 active:scale-95 group",
                isActive
                  ? isTournament ? "text-amber-400" : "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
              data-testid={`nav-${item.href.replace("/", "")}`}
            >
              <div className={cn(
                "p-1.5 rounded-xl transition-all duration-300",
                isActive
                  ? isTournament ? "bg-amber-400/15" : "bg-primary/15"
                  : "bg-transparent group-hover:bg-white/5"
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
