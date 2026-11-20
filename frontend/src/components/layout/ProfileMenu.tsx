import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, LogOut, Settings as SettingsIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

function Avatar({ src, name }: { src?: string; name?: string }) {
  return (
    <div className="w-8 h-8 border-2 border-black shrink-0 overflow-hidden bg-[#FA731C] flex items-center justify-center text-xs font-bold text-white rounded-full">
      {src ? (
        <img src={src} alt={name} className="w-full h-full object-cover" />
      ) : (
        (name?.[0]?.toUpperCase() ?? "U")
      )}
    </div>
  );
}

/** Header profile: avatar + name with a dropdown (same look as NestHR). */
export function ProfileMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  if (!user) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 border-2 border-black bg-white px-2 py-1 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-[#F8FAFF] transition-colors"
        aria-label="Account menu"
      >
        <Avatar src={user.avatar} name={user.name} />
        <span className="hidden md:block text-sm font-bold text-black max-w-[110px] truncate">
          {user.name}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-black transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-64 border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-50">
          <div className="flex items-center gap-3 px-4 py-3 border-b-2 border-black bg-[#024BAB]">
            <Avatar src={user.avatar} name={user.name} />
            <div className="min-w-0">
              <p className="text-sm font-bold text-white truncate">
                {user.name}
              </p>
              <p className="text-[11px] text-white/70 truncate">{user.email}</p>
            </div>
          </div>
          <button
            onClick={() => {
              setOpen(false);
              navigate("/settings");
            }}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-black hover:bg-[#024BAB]/5 text-left"
          >
            <SettingsIcon className="w-3.5 h-3.5" /> Settings
          </button>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 text-left border-t-2 border-black"
          >
            <LogOut className="w-3.5 h-3.5" /> Log out
          </button>
        </div>
      )}
    </div>
  );
}
