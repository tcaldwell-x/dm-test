import { NextResponse } from "next/server";
import { requireUserAuth } from "@/lib/auth";
import { uploadMedia } from "@/lib/x-client";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const auth = await requireUserAuth();
  if (!auth.ok) return auth.response;

  const form = await request.formData();
  const file = form.get("file");
  const mediaCategory = String(form.get("media_category") ?? "dm_image");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (mediaCategory !== "dm_image" && mediaCategory !== "dm_gif" && mediaCategory !== "dm_video") {
    return NextResponse.json({ error: "media_category must be dm_image, dm_gif, or dm_video" }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  try {
    const result = await uploadMedia(
      {
        bytes,
        filename: file.name || "upload",
        mimeType: file.type || "application/octet-stream",
        mediaCategory,
      },
      auth.credentials,
    );
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 },
    );
  }
}
