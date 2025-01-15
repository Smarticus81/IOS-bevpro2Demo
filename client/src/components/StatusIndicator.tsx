import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatusIndicatorProps {
  status: 'connected' | 'disconnected' | 'connecting';
  className?: string;
}

export function StatusIndicator({ status, className }: StatusIndicatorProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    // Show tooltip briefly when status changes
    if (status === 'disconnected') {
      setShowTooltip(true);
      const timer = setTimeout(() => setShowTooltip(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  return (
    <div 
      className={cn(
        'fixed bottom-4 right-4 flex items-center gap-2 p-2 rounded-full transition-all duration-200',
        status === 'connected' ? 'bg-green-100' : 'bg-red-100',
        showTooltip ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-75 hover:opacity-100 hover:translate-y-0',
        className
      )}
    >
      {status === 'connected' ? (
        <>
          <Wifi className="h-4 w-4 text-green-600" />
          <span className="text-sm text-green-700 font-medium">Connected</span>
          <CheckCircle2 className="h-4 w-4 text-green-600" />
        </>
      ) : status === 'connecting' ? (
        <>
          <Wifi className="h-4 w-4 text-yellow-600 animate-pulse" />
          <span className="text-sm text-yellow-700 font-medium">Connecting...</span>
        </>
      ) : (
        <>
          <WifiOff className="h-4 w-4 text-red-600" />
          <span className="text-sm text-red-700 font-medium">Disconnected</span>
          <AlertCircle className="h-4 w-4 text-red-600" />
        </>
      )}
    </div>
  );
}
