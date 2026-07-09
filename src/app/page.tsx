import { ActivityChart } from "@/components/dashboard/ActivityChart";
import { CompanySpotlight } from "@/components/dashboard/CompanySpotlight";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { EvidenceExplainer } from "@/components/dashboard/EvidenceExplainer";
import { KpiCards } from "@/components/dashboard/KpiCards";
import { PlatformPrinciples } from "@/components/dashboard/PlatformPrinciples";
import { RecentlyEmerging } from "@/components/dashboard/RecentlyEmerging";
import { SectorOverview } from "@/components/dashboard/SectorOverview";
import { DemoDataBanner } from "@/components/layout/DemoDataBanner";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";

export default function Home() {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink focus:shadow-md"
      >
        Skip to main content
      </a>
      <SiteHeader />
      <DemoDataBanner />
      <main id="main-content" className="flex-1 pb-16">
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
      </main>
      <SiteFooter />
    </>
  );
}
