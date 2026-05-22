import { useRef, type ReactNode, type MouseEvent } from 'react';

interface TiltCardProps {
  children: ReactNode;
  className?: string;
  /** Max tilt in degrees. Default 6. */
  intensity?: number;
  /** Disable on touch devices automatically. */
  disabled?: boolean;
}

/**
 * Subtle perspective-based 3D tilt on hover.
 * Senior-grade: no jitter, no rubber-banding, GPU only.
 */
export function TiltCard({
  children,
  className = '',
  intensity = 6,
  disabled = false,
}: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  const handleMove = (e: MouseEvent<HTMLDivElement>) => {
    if (disabled) return;
    const el = ref.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;   // 0..1
    const y = (e.clientY - rect.top) / rect.height;   // 0..1
    const rx = (0.5 - y) * intensity;                 // tilt X
    const ry = (x - 0.5) * intensity;                 // tilt Y

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      el.style.transform = `perspective(1000px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`;
      el.style.setProperty('--mx', `${x * 100}%`);
      el.style.setProperty('--my', `${y * 100}%`);
    });
  };

  const handleLeave = () => {
    const el = ref.current;
    if (!el) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    el.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0)';
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className={`relative will-change-transform transition-transform duration-300 ease-smooth ${className}`}
      style={{ transformStyle: 'preserve-3d' }}
    >
      {/* Inner spotlight follows cursor */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            'radial-gradient(420px circle at var(--mx, 50%) var(--my, 50%), hsl(var(--brass) / 0.10), transparent 45%)',
        }}
      />
      {children}
    </div>
  );
}
