// src/shared/services/video-upload.ts
/**
 * Video Upload Service
 * Helper functions for uploading videos from Lesson Studio
 */

export interface VideoUploadData {
  videoBlob: Blob;
  sequenceData: object; // ExplainerSequence
  thumbnail?: Blob;
  metadata: {
    title: string;
    description?: string;
    categoryId?: string;
    duration: number; // seconds
    width: number; // pixels
    height: number; // pixels
  };
}

export interface VideoUploadResponse {
  success: boolean;
  video?: {
    id: string;
    title: string;
    video_url: string;
    sequence_url: string;
    thumbnail_url: string | null;
  };
  error?: string;
}

/**
 * Upload a video from Lesson Studio to R2 and create database record
 */
export async function uploadVideo(data: VideoUploadData): Promise<VideoUploadResponse> {
  try {
    const formData = new FormData();

    // Add video file
    formData.append("videoFile", data.videoBlob, `${Date.now()}.mp4`);

    // Add sequence JSON
    const sequenceBlob = new Blob([JSON.stringify(data.sequenceData)], {
      type: "application/json",
    });
    formData.append("sequenceFile", sequenceBlob, `${Date.now()}-sequence.json`);

    // Add thumbnail if provided
    if (data.thumbnail) {
      formData.append("thumbnailFile", data.thumbnail, `${Date.now()}-thumbnail.jpg`);
    }

    // Add metadata
    formData.append("title", data.metadata.title);
    if (data.metadata.description) {
      formData.append("description", data.metadata.description);
    }
    if (data.metadata.categoryId) {
      formData.append("categoryId", data.metadata.categoryId);
    }
    formData.append("duration", data.metadata.duration.toString());
    formData.append("width", data.metadata.width.toString());
    formData.append("height", data.metadata.height.toString());

    // Upload
    const response = await fetch("/api/admin/videos/upload", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Upload failed");
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Video upload error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Generate a thumbnail from video blob
 * Returns a JPEG blob of the first frame
 */
export async function generateThumbnail(videoBlob: Blob, seekTime = 0): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      const video = document.createElement("video");
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        resolve(null);
        return;
      }

      video.preload = "metadata";
      video.muted = true;
      video.playsInline = true;

      video.onloadedmetadata = () => {
        video.currentTime = seekTime;
      };

      video.onseeked = () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(video.src);
            resolve(blob);
          },
          "image/jpeg",
          0.8
        );
      };

      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        resolve(null);
      };

      video.src = URL.createObjectURL(videoBlob);
    } catch (error) {
      console.error("Thumbnail generation error:", error);
      resolve(null);
    }
  });
}
