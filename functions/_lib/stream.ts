import type { Env } from "./env";

// Cloudflare Stream "direct creator upload" — gives us a one-time URL the
// browser can POST a video file to, without our Worker ever touching the
// bytes. https://developers.cloudflare.com/stream/uploading-videos/direct-creator-uploads/
type DirectUploadResponse = {
  result: {
    uid: string;
    uploadURL: string;
  };
  success: boolean;
  errors: unknown[];
};

export async function createDirectUpload(
  env: Env,
  opts: { maxDurationSeconds: number },
): Promise<{ uid: string; uploadURL: string }> {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/stream/direct_upload`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.CF_STREAM_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        maxDurationSeconds: opts.maxDurationSeconds,
        requireSignedURLs: false,
        allowedOrigins: ["cowboysdocowboyshit.com", "*.pages.dev", "localhost:8788"],
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`stream direct_upload failed: ${res.status}`);
  }
  const json = (await res.json()) as DirectUploadResponse;
  if (!json.success) {
    throw new Error("stream direct_upload returned success=false");
  }
  return { uid: json.result.uid, uploadURL: json.result.uploadURL };
}

type StreamVideoResponse = {
  result: {
    uid: string;
    readyToStream: boolean;
    status: { state: string };
    playback: { hls: string; dash: string };
    thumbnail: string;
    duration: number;
  };
};

export async function getStreamVideo(
  env: Env,
  uid: string,
): Promise<StreamVideoResponse["result"]> {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/stream/${uid}`,
    {
      headers: { Authorization: `Bearer ${env.CF_STREAM_API_TOKEN}` },
    },
  );
  if (!res.ok) throw new Error(`stream get failed: ${res.status}`);
  const json = (await res.json()) as StreamVideoResponse;
  return json.result;
}
