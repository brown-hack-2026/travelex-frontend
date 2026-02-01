import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

const ELEVENLABS_API_KEY = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY;

if (!ELEVENLABS_API_KEY) {
  throw new Error("Missing ELEVENLABS_API_KEY in environment variables");
}

const elevenlabs = new ElevenLabsClient({
  apiKey: ELEVENLABS_API_KEY,
});

export const createAudioStreamFromText = async (text: string) => {
  const audioStream = await elevenlabs.textToSpeech.stream(
    "pVnrL6sighQX7hVz89cp",
    {
      modelId: "eleven_multilingual_v2",
      text,
      // Optional voice settings that allow you to customize the output
      voiceSettings: {
        stability: 0,
        similarityBoost: 1.0,
        useSpeakerBoost: true,
        speed: 1.0,
      },
    }
  );
  return audioStream;
};
