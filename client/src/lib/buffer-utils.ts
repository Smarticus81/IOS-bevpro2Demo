import './buffer-polyfill';

// Browser-safe buffer utilities for base64 and binary data handling
export const BufferUtils = {
  // Convert binary data
  toBinaryArray(data: string | ArrayBuffer | Uint8Array): Uint8Array {
    try {
      if (!window.Buffer) {
        console.error('Buffer polyfill not initialized');
        return new Uint8Array(0);
      }
      return window.Buffer.from(data);
    } catch (error) {
      console.error('toBinaryArray failed:', error);
      return new Uint8Array(0);
    }
  },

  // Convert to base64
  toBase64(data: ArrayBuffer | Uint8Array): string {
    try {
      const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
      let binary = '';
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
    } catch (error) {
      console.error('toBase64 failed:', error);
      return '';
    }
  },

  // Convert from base64
  fromBase64(base64: string): Uint8Array {
    try {
      // Remove data URL prefix if present
      const cleanBase64 = base64.replace(/^data:.*;base64,/, '');
      const binaryString = atob(cleanBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    } catch (error) {
      console.error('fromBase64 failed:', error);
      return new Uint8Array(0);
    }
  },

  // Convert to string
  toString(data: ArrayBuffer | Uint8Array): string {
    try {
      const bytes = this.toBinaryArray(data);
      return new TextDecoder().decode(bytes);
    } catch (error) {
      console.error('toString failed:', error);
      return '';
    }
  },

  // Create blob URL
  createBlobUrl(data: ArrayBuffer | Uint8Array, mimeType: string): string {
    try {
      const bytes = this.toBinaryArray(data);
      const blob = new Blob([bytes], { type: mimeType });
      return URL.createObjectURL(blob);
    } catch (error) {
      console.error('createBlobUrl failed:', error);
      return '';
    }
  },

  // Release blob URL
  releaseBlobUrl(url: string): void {
    try {
      if (url) {
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('releaseBlobUrl failed:', error);
    }
  }
};