"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import TripReportCard from "@/components/TripReportCard";
import { LoadScript } from "@react-google-maps/api";
import { getTripData, TripRecord } from "@/lib/api";

export default function TripRecordPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const [tripRecord, setTripRecord] = useState<TripRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sessionId) {
      getTripData(sessionId)
        .then(setTripRecord)
        .catch(console.error)
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">
        <div className="text-lg">Loading trip record...</div>
      </div>
    );
  }

  if (!tripRecord) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">
        <div className="text-lg">Trip record not found.</div>
      </div>
    );
  }

  return (
    
      <TripReportCard tripRecord={tripRecord} />
    
  );
}
