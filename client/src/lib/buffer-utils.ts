// Browser-safe buffer utilities
export const BufferUtils = {
  // Convert string or ArrayBuffer to Uint8Array
  from(data: string | ArrayBuffer): Uint8Array {
    if (typeof data === 'string') {
      const encoder = new TextEncoder();
      return encoder.encode(data);
    }
    return new Uint8Array(data);
  },

  // Convert buffer to string
  toString(buffer: ArrayBuffer | Uint8Array): string {
    const uint8Array = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
    const decoder = new TextDecoder();
    return decoder.decode(uint8Array);
  },

  // Browser-safe base64 conversion utilities
  fromBase64(base64: string): Uint8Array {
    const binary = atob(base64.replace(/^data:.*;base64,/, ''));
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      array[i] = binary.charCodeAt(i);
    }
    return array;
  },

  toBase64(buffer: ArrayBuffer | Uint8Array): string {
    const uint8Array = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    return btoa(binary);
  }
};