import './buffer-polyfill';

// Browser-safe buffer utilities for base64 and binary data handling
export const BufferUtils = {
  // Convert binary data
  toBinaryArray(data: string | ArrayBuffer | Uint8Array): Uint8Array {
    return window.Buffer.from(data);
  },

  // Convert to base64
  toBase64(data: ArrayBuffer | Uint8Array): string {
    const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  },

  // Convert from base64
  fromBase64(base64: string): Uint8Array {
    // Remove data URL prefix if present
    const cleanBase64 = base64.replace(/^data:.*;base64,/, '');
    const binaryString = atob(cleanBase64);
    return window.Buffer.from(binaryString, 'binary');
  },

  // Convert to string
  toString(data: ArrayBuffer | Uint8Array): string {
    const bytes = this.toBinaryArray(data);
    return new TextDecoder().decode(bytes);
  },

  // Create blob URL
  createBlobUrl(data: ArrayBuffer | Uint8Array, mimeType: string): string {
    const bytes = this.toBinaryArray(data);
    const blob = new Blob([bytes], { type: mimeType });
    return URL.createObjectURL(blob);
  },

  // Release blob URL
  releaseBlobUrl(url: string): void {
    URL.revokeObjectURL(url);
  }
};