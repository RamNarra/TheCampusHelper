
import React from 'react';

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
  // Ads are intentionally disabled ("hide gimmicks"). Keep this component as a no-op so
  // existing page layouts don't need to change.
  void slot;
  void format;
  void layoutKey;
  void className;
  return null;
};

export default AdUnit;
