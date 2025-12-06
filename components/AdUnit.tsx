import React, { useEffect } from 'react';

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
  useEffect(() => {
    try {
      // @ts-ignore
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      console.error("AdSense error:", e);
    }
  }, []);

  // Development placeholder
  if (process.env.NODE_ENV === 'development') {
    return (
      <div className={`w-full bg-white/5 border border-white/10 rounded-lg flex items-center justify-center text-gray-500 text-xs uppercase tracking-widest py-8 my-6 ${className}`}>
        Ad Space ({format})
      </div>
    );
  }

  return (
    <div className={`my-6 overflow-hidden ${className}`}>
      <ins
        className="adsbygoogle block"
        style={{ display: 'block' }}
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