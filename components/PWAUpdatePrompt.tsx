import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const PWAUpdatePrompt: React.FC = () => {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(registration: ServiceWorkerRegistration | undefined) {
      if ((import.meta as any).env?.DEV) console.log('SW Registered:', registration);
    },
    onRegisterError(error: Error) {
      console.error('SW registration error', error);
    },
  });

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  const handleUpdate = () => {
    updateServiceWorker(true);
  };

  if (!offlineReady && !needRefresh) {
    return null;
  }

  return (
    <div className="fixed top-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-slide-down">
      <div className="bg-card border border-border rounded-lg shadow-2xl p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
            <RefreshCw className="w-5 h-5 text-primary" />
          </div>
          
          <div className="flex-grow">
            {offlineReady ? (
              <>
                <h3 className="font-semibold text-foreground mb-1">
                  App ready to work offline
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                  CampusHelper is now available offline!
                </p>
                <button
                  onClick={close}
                  className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium text-sm"
                >
                  Got it
                </button>
              </>
            ) : (
              <>
                <h3 className="font-semibold text-foreground mb-1">
                  Update available
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                  A new version is available. Reload to update.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleUpdate}
                    className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium text-sm"
                  >
                    Update
                  </button>
                  <button
                    onClick={close}
                    className="px-4 py-2 bg-muted text-muted-foreground rounded-md hover:bg-muted/80 transition-colors font-medium text-sm"
                  >
                    Later
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PWAUpdatePrompt;
