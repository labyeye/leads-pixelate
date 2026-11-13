import { useAuth } from "@/contexts/AuthContext";
import { Bell, Search, Menu, Cake, PartyPopper, CheckCheck, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { celebrationsAPI, notificationsAPI, type AppNotification } from "@/services/api";
import { PaceBadge } from "./PaceBadge";

interface AppHeaderProps {
  title: string;
  onMenuOpen: () => void;
}

export function AppHeader({ title, onMenuOpen }: AppHeaderProps) {
  const { user } = useAuth();
  const [searchVal, setSearchVal] = useState("");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);

  const loadNotifs = () =>
    notificationsAPI
      .list()
      .then((r) => {
        setNotifs(r.data ?? []);
        setUnread(r.unread ?? 0);
      })
      .catch(() => {});

  // Unread count for the badge: on load and every minute while the tab is open.
  useEffect(() => {
    if (!user) return;
    const tick = () => notificationsAPI.unreadCount().then((r) => setUnread(r.unread ?? 0)).catch(() => {});
    tick();
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, [user]);

  useEffect(() => {
    if (open) loadNotifs();
  }, [open]);

  const route = (n: AppNotification) => {
    const { screen, id } = n.data || {};
    if (screen === "LeadDetail" && id) return `/leads?lead=${id}`;
    if (screen === "Leads") return "/leads";
    if (screen === "Quotations") return "/quotations";
    if (screen === "WhatsAppInbox") return "/whatsapp/inbox";
    if (screen === "SocialPlanner") return "/social-planner";
    return null;
  };
  const openNotif = (n: AppNotification) => {
    if (!n.read) {
      setNotifs((cur) => cur.map((x) => (x._id === n._id ? { ...x, read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
      notificationsAPI.markRead(n._id).catch(() => {});
    }
    const to = route(n);
    if (to) {
      setOpen(false);
      navigate(to);
    }
  };
  const ago = (iso: string) => {
    const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
  };

  useEffect(() => {
    if (user) celebrationsAPI.today().then((r) => setItems(r.data ?? [])).catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  if (!user) return null;

  return (
    <header className="h-16 border-b-2 border-black bg-white flex items-center justify-between px-4 sm:px-6 sticky top-0 z-20 shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuOpen}
          className="lg:hidden w-9 h-9 border-2 border-black bg-white flex items-center justify-center hover:bg-[#024BAB] transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-[18px] h-[18px] text-black" />
        </button>
        <h1 className="font-display font-medium text-lg sm:text-xl text-black">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {user.role !== "super_admin" && user.role !== "admin" && <PaceBadge />}
        <div className="hidden md:flex items-center gap-2 border-2 border-black bg-white px-3 py-1.5 w-48 lg:w-52">
          <Search className="w-4 h-4 text-black shrink-0" />
          <input
            type="text"
            placeholder="Search leads..."
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
            className="bg-transparent text-sm outline-none w-full text-black placeholder:text-muted-foreground font-medium"
          />
        </div>

        <div className="relative" ref={panelRef}>
          <button
            onClick={() => setOpen((v) => !v)}
            className="relative w-9 h-9 border-2 border-black bg-white flex items-center justify-center hover:bg-[#024BAB] transition-colors"
            aria-label="Notifications"
          >
            <Bell className="w-[18px] h-[18px] text-black" />
            {(unread > 0 || items.length > 0) && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-[#FA731C] border-2 border-black text-[10px] font-bold text-white flex items-center justify-center">
                {unread > 0 ? (unread > 9 ? "9+" : unread) : ""}
              </span>
            )}
          </button>
          {open && (
            <div className="absolute right-0 top-11 w-80 max-w-[92vw] border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-50 max-h-[80vh] overflow-y-auto">
              <div className="px-4 py-3 border-b-2 border-black bg-[#024BAB] text-sm font-bold text-white flex items-center justify-between">
                <span>Notifications{unread > 0 ? ` (${unread})` : ""}</span>
                <span className="flex gap-1.5">
                  {unread > 0 && (
                    <button
                      title="Mark all read"
                      onClick={() => {
                        setNotifs((c) => c.map((x) => ({ ...x, read: true })));
                        setUnread(0);
                        notificationsAPI.markAllRead().catch(() => {});
                      }}
                      className="hover:text-[#FFDE00]"
                    >
                      <CheckCheck className="w-4 h-4" />
                    </button>
                  )}
                  {notifs.length > 0 && (
                    <button
                      title="Clear all"
                      onClick={() => {
                        setNotifs([]);
                        setUnread(0);
                        notificationsAPI.clear().catch(() => {});
                      }}
                      className="hover:text-[#FFDE00]"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </span>
              </div>
              {notifs.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs font-bold text-muted-foreground">
                  All caught up
                </p>
              ) : (
                notifs.map((n) => (
                  <button
                    key={n._id}
                    onClick={() => openNotif(n)}
                    className={`w-full text-left flex items-start gap-2.5 px-4 py-3 border-b border-black/10 hover:bg-[#FFF1E6] ${
                      n.read ? "" : "bg-[#FFF8F1]"
                    }`}
                  >
                    <span className={`mt-1.5 w-2 h-2 shrink-0 ${n.read ? "bg-transparent" : "bg-[#FA731C]"}`} />
                    <span className="min-w-0 flex-1">
                      <span className={`block text-xs text-black ${n.read ? "" : "font-bold"}`}>{n.title}</span>
                      {n.body && <span className="block text-[11px] text-muted-foreground truncate">{n.body}</span>}
                    </span>
                    <span className="text-[10px] text-muted-foreground shrink-0">{ago(n.createdAt)}</span>
                  </button>
                ))
              )}
              {items.length > 0 && (
                <div className="px-4 py-2 border-y-2 border-black bg-[#FFF1E6] text-[11px] font-bold">Today</div>
              )}
              {items.length === 0 ? null : (
                items.map((n) => (
                  <div key={n.id} className="flex items-center gap-3 px-4 py-3 border-b border-black/10 last:border-0">
                    <div className="w-8 h-8 rounded-full border-2 border-black shrink-0 overflow-hidden bg-[#024BAB] flex items-center justify-center text-xs font-bold text-white">
                      {n.avatar ? <img src={n.avatar} alt={n.name} className="w-full h-full object-cover" /> : n.name?.[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-black truncate">{n.name}</p>
                      <p className="flex items-center gap-1 text-[11px] text-[#FA731C]">
                        {n.kind === "birthday" ? <Cake className="w-3 h-3" /> : <PartyPopper className="w-3 h-3" />}
                        {n.kind === "birthday" ? "🎂" : "🎉"} {n.detail}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 border-2 border-black bg-[#024BAB] px-2 sm:px-3 py-1.5">
          <div className="w-6 h-6 border border-white shrink-0 overflow-hidden">
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-white flex items-center justify-center text-[10px] font-medium text-black">
                {user.name?.[0]?.toUpperCase() ?? "U"}
              </div>
            )}
          </div>
          <span className="hidden sm:block text-sm font-medium text-white max-w-[100px] truncate">
            {user.name}
          </span>
        </div>
      </div>
    </header>
  );
}
