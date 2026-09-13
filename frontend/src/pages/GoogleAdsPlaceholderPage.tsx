import { AppLayout } from "@/components/layout/AppLayout";
import { GoogleAdsIcon } from "@/components/icons/GoogleAdsIcon";
import { Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function GoogleAdsPlaceholderPage({
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
            Google Ads {title}
          </h2>
          <p className="text-sm font-medium text-muted-foreground mt-0.5">
            Google Ads campaign management
          </p>
        </div>
      </div>

      <div className="border-2 bg-white p-10 max-w-lg mx-auto text-center space-y-4">
        <div className="w-14 h-14 border-2 border-black bg-[#4285F4]/10 flex items-center justify-center mx-auto relative">
          <GoogleAdsIcon className="w-8 h-8" />
          <div className="absolute -bottom-1.5 -right-1.5 w-6 h-6 bg-black border-2 border-white flex items-center justify-center">
            <Lock className="w-3 h-3 text-white" />
          </div>
        </div>
        <div>
          <h3 className="font-display font-bold text-lg text-black">
            Not available yet
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Google Ads campaign management ({title.toLowerCase()}) requires
            additional Google Ads API scopes. Right now only Lead Sync is
            connected, so leads from your Google Ads Lead Form campaigns flow
            in — spend, campaign, ad group and ad data will show up here once
            that access is enabled.
          </p>
        </div>
        <button
          onClick={() => navigate("/campaigns/google")}
          className="border-2 border-black bg-[#4285F4] text-white px-4 py-2 text-sm font-bold"
        >
          Go to Google Ads Lead Sync Setup →
        </button>
      </div>
    </AppLayout>
  );
}
