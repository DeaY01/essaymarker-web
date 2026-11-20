import { MAX_PAGE_BYTES } from "@/lib/essay-rules";

// Long enough edge to keep handwriting legible, small enough to upload quickly.
const MAX_EDGE_PX = 2000;
const QUALITY_STEPS = [0.85, 0.75, 0.6];

export class PhotoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PhotoError";
  }
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new PhotoError("This photo could not be processed."))),
      "image/jpeg",
      quality,
    );
  });
}

/**
 * Converts any photo the browser can decode into an upright, resized JPEG.
 * `rotation` is extra clockwise rotation in degrees (0, 90, 180 or 270),
 * applied after the camera's own orientation.
 */
export async function preparePhoto(file: File, rotation = 0): Promise<Blob> {
  if (!file.type.startsWith("image/") && file.type !== "") {
    throw new PhotoError("Only photos can be uploaded.");
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new PhotoError(
      "This photo format isn’t supported by your browser. Please use a JPG or PNG photo.",
    );
  }

  try {
    const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const quarterTurn = rotation % 180 !== 0;

    const canvas = document.createElement("canvas");
    canvas.width = quarterTurn ? height : width;
    canvas.height = quarterTurn ? width : height;
    const context = canvas.getContext("2d");
    if (!context) throw new PhotoError("This photo could not be processed.");

    // JPEG has no transparency; paint white so PNG cut-outs don't turn black.
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate((rotation * Math.PI) / 180);
    context.drawImage(bitmap, -width / 2, -height / 2, width, height);

    for (const quality of QUALITY_STEPS) {
      const blob = await canvasToJpeg(canvas, quality);
      if (blob.size <= MAX_PAGE_BYTES) return blob;
    }
    throw new PhotoError("This photo is too large. Please use a smaller image.");
  } finally {
    bitmap.close();
  }
}
