import { AppLayout } from "@/components/layout/AppLayout";
import { LinkedInIcon } from "@/components/icons/LinkedInIcon";
import { Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function LinkedInAdsPlaceholderPage({
  title,
}: {
  title: string;
}) {
  const navigate = useNavigate();

  return (
    <AppLayout title="Campaigns">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h2 className="font-display font-bold text-2xl text-black">
            LinkedIn {title}
          </h2>
          <p className="text-sm font-medium text-muted-foreground mt-0.5">
            LinkedIn campaign management
          </p>
        </div>
      </div>

      <div className="border-2 bg-white p-10 max-w-lg mx-auto text-center space-y-4">
        <div className="w-14 h-14 border-2 border-black bg-[#0A66C2]/10 flex items-center justify-center mx-auto relative">
          <LinkedInIcon className="w-8 h-8" />
          <div className="absolute -bottom-1.5 -right-1.5 w-6 h-6 bg-black border-2 border-white flex items-center justify-center">
            <Lock className="w-3 h-3 text-white" />
          </div>
        </div>
        <div>
          <h3 className="font-display font-bold text-lg text-black">
            Not available yet
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            LinkedIn campaign management ({title.toLowerCase()}) requires
            LinkedIn's Marketing Developer Platform / Advertising API
            approval. Right now only Lead Sync is connected, so leads from
            your LinkedIn Lead Gen Forms flow in — spend, campaign, ad set
            and ad data will show up here once that access is approved.
          </p>
        </div>
        <button
          onClick={() => navigate("/campaigns/linkedin")}
          className="border-2 border-black bg-[#0A66C2] text-white px-4 py-2 text-sm font-bold"
        >
          Go to LinkedIn Lead Sync Setup →
        </button>
      </div>
    </AppLayout>
  );
}
