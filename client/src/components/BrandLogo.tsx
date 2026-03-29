export function BrandLogo({ size = 24, className = '' }: { size?: number, className?: string }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 48 48" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="TraceLens Logo"
    >
      {/* Outer Lens Frame */}
      <circle cx="24" cy="24" r="20" stroke="#46536b" strokeWidth="2.5" />
      <circle cx="24" cy="24" r="20" stroke="#3b82f6" strokeWidth="8" opacity="0.1" />

      {/* Main Execution Path (Smooth Curves) */}
      <path 
        d="M6 24 H 20 C 26 24 26 14 34 14" 
        stroke="#3b82f6" 
        strokeWidth="3.5" 
        strokeLinecap="round" 
      />
      
      {/* Divergent / Branching Path */}
      <path 
        d="M20 24 C 26 24 26 34 34 34" 
        stroke="#8b5cf6" 
        strokeWidth="3.5" 
        strokeLinecap="round" 
      />

      {/* Origin Node */}
      <circle cx="6" cy="24" r="3.5" fill="#a2b7d6" />
      
      {/* Junction Node */}
      <circle cx="20" cy="24" r="4.5" fill="#151d2b" stroke="#ffffff" strokeWidth="2.5" />
      
      {/* Terminal Node A */}
      <circle cx="34" cy="14" r="4" fill="#151d2b" stroke="#3b82f6" strokeWidth="2.5" />
      
      {/* Terminal Node B */}
      <circle cx="34" cy="34" r="4" fill="#151d2b" stroke="#8b5cf6" strokeWidth="2.5" />
    </svg>
  );
}
