import { BottomNav } from "@/components/ui/bottom-nav";
import { Construction } from "lucide-react";

const PlaceholderPage = ({ title }: { title: string }) => (
  <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 pb-24 text-center">
    <div className="bg-primary/10 p-4 rounded-full mb-4">
      <Construction className="h-10 w-10 text-primary animate-pulse" />
    </div>
    <h1 className="text-2xl font-display mb-2">{title}</h1>
    <p className="text-muted-foreground">This feature is coming in a future update.</p>
    <BottomNav />
  </div>
);

export const StatsPage = () => <PlaceholderPage title="Statistics" />;
export const RotationPage = () => <PlaceholderPage title="Rotation Manager" />;
export const SettingsPage = () => <PlaceholderPage title="Settings" />;
