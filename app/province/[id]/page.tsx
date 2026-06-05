import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ProvinceProgressBadge } from "@/components/HomeProgress";
import ProvinceMap from "@/components/ProvinceMap";
import { getCitiesByProvince } from "@/data/cities";
import { getProvinceCityTotal } from "@/data/provinceCityPlaces";
import { getProvince, provinces } from "@/data/provinces";

interface ProvincePageProps {
  params: Promise<{ id: string }>;
}

export function generateStaticParams() {
  return provinces.map((province) => ({ id: province.id }));
}

export default async function ProvincePage({ params }: ProvincePageProps) {
  const { id } = await params;
  const province = getProvince(id);

  if (!province) notFound();

  const provinceCities = getCitiesByProvince(province.id);
  const provinceCityTotal = getProvinceCityTotal(province.id);
  const cityTotal = provinceCityTotal || provinceCities.length;

  return (
    <main className="relative h-[100dvh] max-h-[100dvh] overflow-hidden bg-[#FAFBF7] text-[#5A6670]">
      <div className="map-mist-band" aria-hidden="true" />
      <span className="absolute left-[12%] top-[19%] h-2 w-2 bg-[#D4E8D0]" aria-hidden="true" />
      <span className="absolute right-[12%] top-[32%] h-2 w-2 bg-[#D6E8F0]" aria-hidden="true" />

      <div className="relative z-10 flex h-full min-h-0 flex-col overflow-hidden px-6 py-7 sm:px-9">
        <header className="relative z-40 flex shrink-0 items-start justify-between gap-5">
          <div className="flex items-center gap-5">
            <Link
              className="grid h-12 w-12 place-items-center rounded-[8px] border border-[#5A6670]/35 bg-[#FAFBF7]/76 text-[#5A6670] shadow-[0_8px_24px_rgba(90,102,112,0.08)] backdrop-blur transition hover:border-[#A8C8DC] hover:text-[#A8C8DC]"
              href="/map"
              aria-label="返回全国地图"
            >
              <ArrowLeft className="h-6 w-6" />
            </Link>
            <div className="flex items-baseline gap-3">
              <h1 className="text-[28px] font-semibold tracking-[-0.01em] text-[#5A6670]">
                {province.name}
              </h1>
              <p className="text-lg font-medium text-[#5A6670]/72">{province.nameEn}</p>
            </div>
            <ProvinceProgressBadge provinceId={province.id} total={cityTotal} />
          </div>

          <div aria-hidden="true" />
        </header>

        <section className="relative z-10 flex min-h-0 flex-1 items-start justify-center overflow-hidden pb-28 pt-8 sm:pb-16">
          <ProvinceMap province={province} />
        </section>

        <div className="absolute bottom-8 left-6 z-40 rounded-[8px] border border-[#D8DDD8]/80 bg-[#FAFBF7]/76 px-5 py-4 text-sm text-[#5A6670]/78 shadow-[0_10px_28px_rgba(90,102,112,0.08)] backdrop-blur sm:left-9">
          <div className="flex items-center gap-3">
            <span className="h-3.5 w-3.5 rounded-full bg-[#E8B8C2] shadow-[0_0_10px_rgba(232,184,194,0.55)]" />
            <span>已探索</span>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <span className="h-3.5 w-3.5 rounded-full bg-[#B9BEC3]" />
            <span>未探索</span>
          </div>
        </div>
      </div>
    </main>
  );
}
