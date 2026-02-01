"use client";

import { useEffect, useRef, useState } from "react";

interface CameraModalProps {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}

type CameraStatus = "idle" | "requesting" | "ready" | "error";

const CAMERA_NOT_SUPPORTED_MESSAGE =
  "Camera access is not supported in this browser.";

export default function CameraModal({
  open,
  onClose,
  onCapture,
}: CameraModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [captureBusy, setCaptureBusy] = useState(false);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    async function initCamera() {
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        setStatus("error");
        setErrorMessage(CAMERA_NOT_SUPPORTED_MESSAGE);
        return;
      }

      setStatus("requesting");
      setErrorMessage(null);
      setCaptureError(null);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
          },
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          const playPromise = videoRef.current.play();
          if (playPromise) {
            playPromise.catch(() => {
              /* Ignore autoplay rejections triggered by tab visibility changes */
            });
          }
        }

        setStatus("ready");
      } catch (error) {
        if (cancelled) return;

        let message =
          "Unable to access the camera. Please check your browser permissions.";
        if (error instanceof DOMException) {
          if (error.name === "NotAllowedError" || error.name === "SecurityError")
            message =
              "Camera permission was denied. Please enable it in your browser settings.";
          else if (error.name === "NotFoundError")
            message = "No camera was found on this device.";
          else if (error.message) message = error.message;
        }

        setStatus("error");
        setErrorMessage(message);
      }
    }

    initCamera();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [open, retryToken]);

  useEffect(() => {
    if (!open) {
      setStatus("idle");
      setErrorMessage(null);
      setCaptureBusy(false);
      setCaptureError(null);
    }
  }, [open]);

  const handleCapture = async () => {
    if (!videoRef.current || status !== "ready") return;

    setCaptureBusy(true);
    setCaptureError(null);

    try {
      const video = videoRef.current;
      const width = video.videoWidth || video.clientWidth || 1280;
      const height = video.videoHeight || video.clientHeight || 720;

      if (!width || !height) {
        throw new Error("Camera is still initializing. Please try again.");
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Unable to capture image from the camera feed.");
      }

      ctx.drawImage(video, 0, 0, width, height);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (canvasBlob) => {
            if (!canvasBlob) {
              reject(new Error("Failed to capture photo."));
              return;
            }
            resolve(canvasBlob);
          },
          "image/jpeg",
          0.95,
        );
      });

      const file = new File([blob], `photo-${Date.now()}.jpg`, {
        type: blob.type,
      });

      onCapture(file);
      onClose();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "We couldn't capture a photo. Please try again.";
      setCaptureError(message);
    } finally {
      setCaptureBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="bg-neutral-900 rounded-2xl p-4 flex flex-col items-center">
        <div className="relative rounded-lg w-[320px] h-[240px] mb-4 overflow-hidden bg-black">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className={`h-full w-full object-cover transition-opacity duration-300 ${
              status === "ready" ? "opacity-100" : "opacity-0"
            }`}
          />
          {status !== "ready" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center text-sm text-neutral-200 bg-black/70 backdrop-blur rounded-lg">
              <p>
                {status === "requesting"
                  ? "Waiting for camera permission..."
                  : status === "idle"
                    ? "Initializing camera..."
                    : errorMessage || CAMERA_NOT_SUPPORTED_MESSAGE}
              </p>
              {status === "error" && (
                <button
                  onClick={() => setRetryToken((token) => token + 1)}
                  className="mt-4 rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold text-white hover:bg-white/20 transition"
                >
                  Try Again
                </button>
              )}
            </div>
          )}
        </div>
        {captureError && (
          <p className="mb-3 text-xs text-red-300 text-center max-w-[320px]">
            {captureError}
          </p>
        )}
        <div className="flex gap-4">
          <button
            onClick={handleCapture}
            disabled={status !== "ready" || captureBusy}
            className="px-4 py-2 rounded bg-emerald-500 text-white font-semibold shadow disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {captureBusy ? "Capturing..." : "Take Photo"}
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
