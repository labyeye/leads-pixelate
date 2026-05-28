import { useState, useEffect } from "react";
import { activityAPI } from "@/services/api";
import {
  Target,
  FileText,
  PhoneCall,
  UserCheck,
  Briefcase,
  Loader2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

const iconMap: Record<string, any> = {
  lead: Target,
  client: UserCheck,
  quotation: FileText,
  service: Briefcase,
  product: Briefcase,
  user: UserCheck,
  auth: PhoneCall,
  default: Target,
};

const colorMap: Record<string, string> = {
  lead: "text-primary bg-primary/10",
  client: "text-success bg-success/10",
  quotation: "text-secondary bg-secondary/10",
  service: "text-muted-foreground bg-muted",
  product: "text-muted-foreground bg-muted",
  user: "text-warning bg-warning/10",
  auth: "text-warning bg-warning/10",
  default: "text-primary bg-primary/10",
};

export function RecentActivity() {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const res = await activityAPI.getLogs({ limit: "6" });
        if (res.success) {
          setActivities(res.data);
        }
      } catch (error) {
        console.error("Failed to fetch activities:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchActivities();
  }, []);

  return (
    <div className="bg-card rounded-xl border border-border p-5 card-shadow">
      <h3 className="text-sm font-semibold text-foreground mb-4">
        Recent Activity
      </h3>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : activities.length === 0 ? (
        <div className="text-center py-6 text-sm text-muted-foreground">
          No recent activity found.
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map((item, i) => {
            const mod = (item.module || "").toLowerCase();
            const Icon = iconMap[mod] || iconMap.default;
            const colorClass = colorMap[mod] || colorMap.default;

            return (
              <div
                key={item._id}
                className="flex items-start gap-3 animate-fade-in"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div
                  className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                    colorClass,
                  )}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground leading-snug">
                    {item.description}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {item.userName} ·{" "}
                    {formatDistanceToNow(new Date(item.timestamp), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
