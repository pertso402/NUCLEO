const noise =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

/**
 * Fundo do HUD (DESIGN §5.1): luzes ambientes de neon (Volt, Plasma, Ion) que derivam devagar,
 * grade de 32px, linhas de varredura e ruído. Tudo fixo, atrás de tudo, sem eventos.
 * As luzes são gradientes radiais (sem `filter: blur`) e só animam `transform` — barato no iPhone.
 */
export function GridBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-bg-0">
      {/* Luzes ambientes */}
      <div
        className="absolute -top-[20%] -left-[25%] h-[70vh] w-[90vw] opacity-70 will-change-transform motion-safe:animate-[nucleo-drift_24s_ease-in-out_infinite]"
        style={{ background: "radial-gradient(closest-side, rgba(200,255,46,0.16), rgba(200,255,46,0.05) 55%, transparent)" }}
      />
      <div
        className="absolute top-[15%] -right-[30%] h-[80vh] w-[90vw] opacity-80 will-change-transform motion-safe:animate-[nucleo-drift_30s_ease-in-out_infinite_reverse]"
        style={{ background: "radial-gradient(closest-side, rgba(124,92,255,0.20), rgba(124,92,255,0.06) 55%, transparent)" }}
      />
      <div
        className="absolute -bottom-[25%] left-[5%] h-[60vh] w-[80vw] opacity-60 will-change-transform motion-safe:animate-[nucleo-drift_36s_ease-in-out_infinite]"
        style={{ background: "radial-gradient(closest-side, rgba(46,230,255,0.14), rgba(46,230,255,0.04) 55%, transparent)" }}
      />

      {/* Grade */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.055) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.055) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          maskImage: "radial-gradient(ellipse 90% 75% at 50% 25%, #000 25%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 90% 75% at 50% 25%, #000 25%, transparent 100%)",
        }}
      />

      {/* Horizonte de luz no topo */}
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(200,255,46,0.5), rgba(46,230,255,0.4), transparent)" }}
      />

      {/* Linhas de varredura */}
      <div
        className="absolute inset-0 opacity-[0.25]"
        style={{ backgroundImage: "repeating-linear-gradient(to bottom, rgba(0,0,0,0.35) 0 1px, transparent 1px 3px)" }}
      />
      <div className="absolute inset-0 opacity-[0.035]" style={{ backgroundImage: noise }} />
    </div>
  );
}
