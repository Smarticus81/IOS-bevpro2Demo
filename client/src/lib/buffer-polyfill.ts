// Browser-safe Buffer polyfill
const safeBuffer = {
  from(data: string | ArrayBuffer | Uint8Array): Uint8Array {
    if (typeof data === 'string') {
      return new TextEncoder().encode(data);
    }
    if (data instanceof ArrayBuffer) {
      return new Uint8Array(data);
    }
    return data;
  },

  alloc(size: number): Uint8Array {
    return new Uint8Array(size);
  },

  allocUnsafe(size: number): Uint8Array {
    return new Uint8Array(size);
  },

  isBuffer(obj: any): boolean {
    return obj instanceof Uint8Array;
  },

  // Add additional Buffer-like functionality
  concat(list: Uint8Array[]): Uint8Array {
    const totalLength = list.reduce((acc, buf) => acc + buf.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const buf of list) {
      result.set(buf, offset);
      offset += buf.length;
    }
    return result;
  },

  // Add polyfill marker
  isPolyfill: true
};

// Define the Buffer interface
interface BufferConstructor {
  from(data: string | ArrayBuffer | Uint8Array): Uint8Array;
  alloc(size: number): Uint8Array;
  allocUnsafe(size: number): Uint8Array;
  isBuffer(obj: any): boolean;
  concat(list: Uint8Array[]): Uint8Array;
  isPolyfill: boolean;
}

// Expose Buffer globally
declare global {
  interface Window {
    Buffer: BufferConstructor;
  }

  var Buffer: BufferConstructor;
}

// Install the polyfill
if (typeof window !== 'undefined') {
  window.Buffer = safeBuffer as BufferConstructor;
}

if (typeof global !== 'undefined') {
  (global as any).Buffer = safeBuffer;
}

export default safeBuffer;