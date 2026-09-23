"use client";
import { useState, useEffect } from "react";
import { getAlerts, getLatestMerged, getStations, loadAlerts } from "@/lib/data";
import AvisosTabs from "@/components/AvisosTabs";
import AvisosBanner from "@/components/AvisosBanner";
import type { Alert, Observation } from "@/lib/types";

export default function AvisosPage() {
  const [alerts, setAlerts] = useState<Alert[]>(getAlerts);
  const [latest, setLatest] = useState<Record<string, Observation>>(() => getLatestMerged());
  const stations = getStations();

  useEffect(() => {
    setAlerts(loadAlerts());
    setLatest(getLatestMerged());
  }, []);

  return (
    <div className="min-h-screen bg-senamhi-bg">
      <AvisosBanner />
      <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
        <AvisosTabs alerts={alerts} stations={stations} latest={latest} />
      </div>
    </div>
  );
}
