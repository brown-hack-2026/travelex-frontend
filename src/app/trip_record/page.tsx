"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import TripReportCard from "@/components/TripReportCard";
import { getTripData, TripRecord } from "@/lib/api";

const ScreenMessage = ({ message }: { message: string }) => (
  <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">
    <div className="text-lg">{message}</div>
  </div>
);

function TripRecordPageContent() {
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
    return <ScreenMessage message="Loading trip record..." />;
  }

  if (!tripRecord) {
    return <ScreenMessage message="Trip record not found." />;
  }

  return (
    <TripReportCard tripRecord={tripRecord} />
  );
}

export default function TripRecordPage() {
  return (
    <Suspense fallback={<ScreenMessage message="Loading trip record..." />}>
      <TripRecordPageContent />
    </Suspense>
  );
}
