import { ActivityChart } from "@/components/dashboard/ActivityChart";
import { CompanySpotlight } from "@/components/dashboard/CompanySpotlight";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { EvidenceExplainer } from "@/components/dashboard/EvidenceExplainer";
import { KpiCards } from "@/components/dashboard/KpiCards";
import { PlatformPrinciples } from "@/components/dashboard/PlatformPrinciples";
import { RecentlyEmerging } from "@/components/dashboard/RecentlyEmerging";
import { SectorOverview } from "@/components/dashboard/SectorOverview";

export default function Home() {
  return (
    <>
      <DashboardHero />
      <KpiCards />
      <SectorOverview />
      <section className="mt-8 px-4 sm:px-6">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-2">
          <RecentlyEmerging />
          <ActivityChart />
        </div>
      </section>
      <section className="mt-6 px-4 sm:px-6">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-3">
          <CompanySpotlight />
          <EvidenceExplainer />
          <PlatformPrinciples />
        </div>
      </section>
    </>
  );
}
