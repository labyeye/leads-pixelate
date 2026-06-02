import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

const PLAN_META: Record<string, { label: string; color: string; emoji: string }> = {
  starter: { label: "Starter", color: "#A3E635", emoji: "⚡" },
  growth:  { label: "Growth",  color: "#024BAB", emoji: "🚀" },
  enterprise: { label: "Enterprise", color: "#A855F7", emoji: "👑" },
};

const PARTICLES = Array.from({ length: 60 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  delay: Math.random() * 3,
  duration: 2.5 + Math.random() * 2.5,
  size: 6 + Math.random() * 8,
  color: ["#024BAB", "#A3E635", "#F59E0B", "#EC4899", "#A855F7", "#10B981", "#EF4444"][
    Math.floor(Math.random() * 7)
  ],
  rotate: Math.random() * 360,
  shape: Math.random() > 0.5 ? "circle" : "rect",
}));

export default function PaymentSuccessPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const plan = params.get("plan") || "growth";
  const billing = params.get("billing") || "monthly";
  const meta = PLAN_META[plan] || PLAN_META.growth;

  const [countdown, setCountdown] = useState(7);
  const [checkVisible, setCheckVisible] = useState(false);
  const [textVisible, setTextVisible] = useState(false);
  const [cardVisible, setCardVisible] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const t1 = setTimeout(() => setCheckVisible(true), 200);
    const t2 = setTimeout(() => setTextVisible(true), 800);
    const t3 = setTimeout(() => setCardVisible(true), 1300);

    intervalRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(intervalRef.current!);
          navigate("/", { replace: true });
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearInterval(intervalRef.current!);
    };
  }, [navigate]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #020617 0%, #0c1445 40%, #0f172a 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        position: "relative",
        fontFamily: "'Segoe UI', system-ui, sans-serif",
      }}
    >
      <style>{`
        @keyframes confetti-fall {
          0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
        @keyframes check-pop {
          0%   { transform: scale(0) rotate(-20deg); opacity: 0; }
          60%  { transform: scale(1.15) rotate(5deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes glow-ring {
          0%, 100% { box-shadow: 0 0 30px 8px rgba(2,75,171,0.5); }
          50%       { box-shadow: 0 0 60px 20px rgba(2,75,171,0.9); }
        }
        @keyframes slide-up {
          0%   { transform: translateY(32px); opacity: 0; }
          100% { transform: translateY(0);    opacity: 1; }
        }
        @keyframes fade-in {
          0%   { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes pulse-badge {
          0%, 100% { transform: scale(1); }
          50%       { transform: scale(1.04); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
      `}</style>

      {/* Confetti particles */}
      {PARTICLES.map((p) => (
        <div
          key={p.id}
          style={{
            position: "absolute",
            top: "-20px",
            left: `${p.x}%`,
            width: p.size,
            height: p.size,
            background: p.color,
            borderRadius: p.shape === "circle" ? "50%" : "2px",
            animation: `confetti-fall ${p.duration}s ${p.delay}s linear infinite`,
            opacity: 0,
          }}
        />
      ))}

      {/* Checkmark circle */}
      <div
        style={{
          width: 100,
          height: 100,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #024BAB, #0369a1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 32,
          animation: checkVisible
            ? "check-pop 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards, glow-ring 2s 0.6s ease-in-out infinite"
            : "none",
          opacity: checkVisible ? 1 : 0,
          transform: checkVisible ? undefined : "scale(0)",
        }}
      >
        <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
          <polyline
            points="10,28 22,40 42,16"
            stroke="white"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="60"
            strokeDashoffset={checkVisible ? "0" : "60"}
            style={{ transition: "stroke-dashoffset 0.5s ease 0.4s" }}
          />
        </svg>
      </div>

      {/* Headline */}
      <div
        style={{
          textAlign: "center",
          maxWidth: 520,
          padding: "0 24px",
          animation: textVisible ? "slide-up 0.6s ease forwards" : "none",
          opacity: textVisible ? 1 : 0,
          transform: textVisible ? undefined : "translateY(32px)",
        }}
      >
        <h1
          style={{
            margin: "0 0 10px",
            fontSize: "clamp(28px,5vw,42px)",
            fontWeight: 800,
            background: "linear-gradient(90deg, #ffffff 0%, #93c5fd 50%, #ffffff 100%)",
            backgroundSize: "200% auto",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            animation: "shimmer 3s linear infinite",
            lineHeight: 1.1,
          }}
        >
          Welcome to NESTLeads!
        </h1>
        <p
          style={{
            margin: "0 0 24px",
            fontSize: 17,
            color: "#94a3b8",
            lineHeight: 1.6,
          }}
        >
          Your account is live. Time to build your sales pipeline and close more deals.
        </p>
      </div>

      {/* Plan badge card */}
      <div
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.12)",
          backdropFilter: "blur(12px)",
          borderRadius: 20,
          padding: "24px 36px",
          textAlign: "center",
          minWidth: 260,
          animation: cardVisible
            ? "slide-up 0.6s ease forwards, pulse-badge 3s 1s ease-in-out infinite"
            : "none",
          opacity: cardVisible ? 1 : 0,
          marginBottom: 32,
        }}
      >
        <div style={{ fontSize: 36, marginBottom: 8 }}>{meta.emoji}</div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "#64748b",
            textTransform: "uppercase",
            letterSpacing: "1.5px",
            marginBottom: 4,
          }}
        >
          Plan Activated
        </div>
        <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", marginBottom: 4 }}>
          {meta.label}
        </div>
        <div
          style={{
            display: "inline-block",
            background: meta.color + "22",
            border: `1px solid ${meta.color}55`,
            color: meta.color,
            borderRadius: 999,
            padding: "4px 14px",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {billing === "yearly" ? "Yearly" : "Monthly"} · Active
        </div>
      </div>

      {/* CTA buttons */}
      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          justifyContent: "center",
          animation: cardVisible ? "fade-in 0.6s 0.3s ease forwards" : "none",
          opacity: cardVisible ? 1 : 0,
        }}
      >
        <button
          onClick={() => { clearInterval(intervalRef.current!); navigate("/", { replace: true }); }}
          style={{
            background: "#024BAB",
            color: "#fff",
            border: "none",
            borderRadius: 12,
            padding: "14px 32px",
            fontSize: 15,
            fontWeight: 700,
            cursor: "pointer",
            letterSpacing: "0.3px",
          }}
        >
          Go to Dashboard →
        </button>
      </div>

      {/* Countdown */}
      <p
        style={{
          marginTop: 20,
          fontSize: 13,
          color: "#475569",
          animation: cardVisible ? "fade-in 0.6s 0.5s ease forwards" : "none",
          opacity: cardVisible ? 1 : 0,
        }}
      >
        Redirecting automatically in {countdown}s…
      </p>
    </div>
  );
}
