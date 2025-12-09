
import React, { useEffect, useRef } from 'react';

interface AdUnitProps {
  slot?: string;
  format?: 'auto' | 'fluid' | 'rectangle';
  layoutKey?: string;
  className?: string;
}

const AdUnit: React.FC<AdUnitProps> = ({ 
  slot = "1234567890", // Replace with default slot ID
  format = "auto", 
  layoutKey,
  className = "" 
}) => {
  const adRef = useRef<HTMLModElement>(null);
  const pushedRef = useRef(false);

  // Safe check for development mode to avoid "Cannot read properties of undefined (reading 'DEV')"
  const isDevelopment = (() => {
    try {
      // @ts-ignore
      return typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV;
    } catch (e) {
      return false;
    }
  })();

  useEffect(() => {
    // Check if we are in development mode
    if (isDevelopment) return;

    try {
      if (typeof window !== 'undefined' && !pushedRef.current) {
         // Wrap in setTimeout to ensure the element has layout dimensions (fixes availableWidth=0 error)
         // This is critical when components are inside Framer Motion animations or initially hidden containers
         const timer = setTimeout(() => {
            if (adRef.current) {
                // Ensure element is visible (offsetParent is not null) and has width
                if (adRef.current.offsetParent !== null && adRef.current.clientWidth > 0) {
                    // @ts-ignore
                    (window.adsbygoogle = window.adsbygoogle || []).push({});
                    pushedRef.current = true;
                }
            }
         }, 800); // 800ms delay to allow layout transitions to settle
         
         return () => clearTimeout(timer);
      }
    } catch (e) {
      console.error("AdSense error:", e);
    }
  }, [isDevelopment]);

  // Development placeholder
  if (isDevelopment) {
    return (
      <div className={`w-full bg-muted/10 border border-dashed border-border rounded-lg flex items-center justify-center text-muted-foreground text-xs uppercase tracking-widest py-8 my-6 ${className}`} style={{ minHeight: '100px' }}>
        Ad Space ({format}) - Dev Mode
      </div>
    );
  }

  return (
    <div className={`my-6 w-full flex justify-center overflow-hidden ${className}`} style={{ minHeight: '100px' }}>
      <ins
        ref={adRef}
        className="adsbygoogle block"
        style={{ display: 'block', minWidth: '250px', width: '100%' }}
        data-ad-client="ca-pub-XXXXXXXXXXXXXXXX" // Replace with your Publisher ID
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
        {...(layoutKey ? { "data-ad-layout-key": layoutKey } : {})}
      />
    </div>
  );
};

export default AdUnit;
