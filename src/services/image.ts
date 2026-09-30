export const MAX_IMAGE_EDGE = 2000;
export const JPEG_QUALITY = 0.85;

export interface ImageDimensions {
  width: number;
  height: number;
}

interface DecodedImage extends ImageDimensions {
  source: CanvasImageSource;
  close?: () => void;
}

export interface ImageResizeEnvironment {
  decode: (file: File) => Promise<DecodedImage>;
  createCanvas: () => HTMLCanvasElement;
}

export interface ResizedImage extends ImageDimensions {
  mimeType: 'image/jpeg';
  base64Data: string;
}

export function calculateResizeDimensions(
  width: number,
  height: number,
  maxEdge = MAX_IMAGE_EDGE,
): ImageDimensions {
  if (width <= 0 || height <= 0) throw new Error('Fotoğrafın boyutları okunamadı.');
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

async function decodeWithBrowser(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { width: bitmap.width, height: bitmap.height, source: bitmap, close: () => bitmap.close() };
    } catch {
      // Safari can decode some iPhone formats through an image element even when createImageBitmap cannot.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
    await image.decode();
    return { width: image.naturalWidth, height: image.naturalHeight, source: image };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function defaultEnvironment(): ImageResizeEnvironment {
  return {
    decode: decodeWithBrowser,
    createCanvas: () => document.createElement('canvas'),
  };
}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Fotoğraf JPEG biçimine çevrilemedi.'));
      },
      'image/jpeg',
      JPEG_QUALITY,
    );
  });
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const chunkSize = 8_192;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

export async function resizeImage(
  file: File,
  environment: ImageResizeEnvironment = defaultEnvironment(),
): Promise<ResizedImage> {
  if (!file.type.startsWith('image/')) throw new Error('Lütfen bir fotoğraf dosyası seçin.');
  const decoded = await environment.decode(file);
  try {
    const dimensions = calculateResizeDimensions(decoded.width, decoded.height);
    const canvas = environment.createCanvas();
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Fotoğraf işlenemedi.');
    context.drawImage(decoded.source, 0, 0, dimensions.width, dimensions.height);
    const blob = await canvasToJpeg(canvas);
    return {
      ...dimensions,
      mimeType: 'image/jpeg',
      base64Data: await blobToBase64(blob),
    };
  } finally {
    decoded.close?.();
  }
}
