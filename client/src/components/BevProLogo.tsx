import { Wine } from "lucide-react";

export function BevProLogo() {
  return (
    <div className="flex items-center gap-2">
      <div className="p-2 rounded-full bg-gradient-to-r from-mint to-lavender">
        <Wine className="h-6 w-6 text-white" />
      </div>
      <span className="text-2xl font-bold bg-gradient-to-r from-mint to-lavender bg-clip-text text-transparent">
        BevPro
      </span>
    </div>
  );
}
