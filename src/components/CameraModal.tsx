import { useEffect, useRef } from "react";

interface CameraModalProps {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}

export default function CameraModal({
  open,
  onClose,
  onCapture,
}: CameraModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (e) {
        alert("Unable to access camera");
        onClose();
      }
    })();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [open, onClose]);

  const handleCapture = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], `photo-${Date.now()}.jpg`, {
            type: "image/jpeg",
          });
          onCapture(file);
          onClose();
        }
      },
      "image/jpeg",
      0.95,
    );
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="bg-neutral-900 rounded-2xl p-4 flex flex-col items-center">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="rounded-lg w-[320px] h-[240px] bg-black mb-4"
        />
        <div className="flex gap-4">
          <button
            onClick={handleCapture}
            className="px-4 py-2 rounded bg-emerald-500 text-white font-semibold shadow"
          >
            Take Photo
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-neutral-700 text-white font-semibold"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
