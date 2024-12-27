// Browser-safe Buffer polyfill
const safeBuffer = {
  // Helper function to calculate UTF-8 string length
  byteLengthUtf8(str: string): number {
    let byteLength = 0;
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      if (code <= 0x7F) {
        byteLength += 1;
      } else if (code <= 0x7FF) {
        byteLength += 2;
      } else if (code >= 0xD800 && code <= 0xDFFF) {
        // Surrogate pair
        i++;
        byteLength += 4;
      } else {
        byteLength += 3;
      }
    }
    return byteLength;
  },

  from(data: string | ArrayBuffer | Uint8Array, encoding?: string): Uint8Array {
    try {
      if (typeof data === 'string') {
        if (encoding === 'base64') {
          const binaryString = atob(data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          return bytes;
        }
        return new TextEncoder().encode(data);
      }
      if (data instanceof ArrayBuffer) {
        return new Uint8Array(data);
      }
      if (data instanceof Uint8Array) {
        return data;
      }
      console.warn('Buffer.from received unexpected data type:', typeof data);
      return new Uint8Array(0);
    } catch (error) {
      console.error('Buffer.from failed:', error);
      return new Uint8Array(0);
    }
  },

  alloc(size: number): Uint8Array {
    try {
      const buf = new Uint8Array(size);
      // Add write methods to the buffer instance
      Object.defineProperties(buf, {
        write: {
          value: function(string: string, offset?: number, length?: number, encoding: string = 'utf8'): number {
            try {
              offset = offset >>> 0;
              const remaining = this.length - offset;
              if (!length) {
                length = remaining;
              }
              let strLen;
              if (encoding === 'utf8') {
                strLen = this.constructor.byteLengthUtf8(string);
                if (length > remaining) length = remaining;
                const bytes = new TextEncoder().encode(string);
                this.set(bytes.slice(0, length), offset);
                return Math.min(length, strLen);
              } else if (encoding === 'ascii') {
                strLen = string.length;
                if (length > remaining) length = remaining;
                for (let i = 0; i < length; ++i) {
                  this[offset + i] = string.charCodeAt(i) & 0xFF;
                }
                return Math.min(length, strLen);
              } else if (encoding === 'base64') {
                const bytes = this.constructor.from(string, 'base64');
                if (length > remaining) length = remaining;
                this.set(bytes.slice(0, length), offset);
                return length;
              }
              return 0;
            } catch (error) {
              console.error('write failed:', error);
              return 0;
            }
          }
        },
        writeUInt32BE: {
          value: function(value: number, offset: number = 0): number {
            if (offset + 4 > this.length) {
              throw new Error('Writing beyond buffer bounds');
            }
            this[offset] = (value >>> 24) & 0xff;
            this[offset + 1] = (value >>> 16) & 0xff;
            this[offset + 2] = (value >>> 8) & 0xff;
            this[offset + 3] = value & 0xff;
            return offset + 4;
          }
        },
        writeUInt8: {
          value: function(value: number, offset: number = 0): number {
            if (offset >= this.length) {
              throw new Error('Writing beyond buffer bounds');
            }
            this[offset] = value & 0xff;
            return offset + 1;
          }
        },
        byteLength: {
          get: function() {
            return this.length;
          }
        },
        toString: {
          value: function(encoding?: string, start?: number, end?: number): string {
            try {
              const slice = this.slice(start, end);
              if (encoding === 'base64') {
                const chars = Array.from(slice);
                return btoa(String.fromCharCode.apply(null, chars));
              }
              return new TextDecoder().decode(slice);
            } catch (error) {
              console.error('toString failed:', error);
              return '';
            }
          }
        },
        readUInt32BE: {
          value: function(offset: number = 0): number {
            if (offset + 4 > this.length) {
              throw new Error('Reading beyond buffer bounds');
            }
            return (this[offset] << 24) |
                   (this[offset + 1] << 16) |
                   (this[offset + 2] << 8) |
                   this[offset + 3];
          }
        },
        readUInt8: {
          value: function(offset: number = 0): number {
            if (offset >= this.length) {
              throw new Error('Reading beyond buffer bounds');
            }
            return this[offset];
          }
        }
      });
      return buf;
    } catch (error) {
      console.error('Buffer.alloc failed:', error);
      return new Uint8Array(0);
    }
  },

  allocUnsafe(size: number): Uint8Array {
    return this.alloc(size);
  },

  isBuffer(obj: any): boolean {
    return obj instanceof Uint8Array;
  },

  concat(list: Uint8Array[]): Uint8Array {
    try {
      const totalLength = list.reduce((acc, buf) => acc + buf.length, 0);
      const result = new Uint8Array(totalLength);
      let offset = 0;
      for (const buf of list) {
        result.set(buf, offset);
        offset += buf.length;
      }
      return result;
    } catch (error) {
      console.error('Buffer.concat failed:', error);
      return new Uint8Array(0);
    }
  },

  isPolyfill: true,

  // Add static write methods
  writeUInt32BE(buffer: Uint8Array, value: number, offset: number = 0): number {
    if (offset + 4 > buffer.length) {
      throw new Error('Writing beyond buffer bounds');
    }
    buffer[offset] = (value >>> 24) & 0xff;
    buffer[offset + 1] = (value >>> 16) & 0xff;
    buffer[offset + 2] = (value >>> 8) & 0xff;
    buffer[offset + 3] = value & 0xff;
    return offset + 4;
  },

  byteLength(string: string, encoding?: string): number {
    if (encoding === 'base64') {
      const base64Length = string.replace(/[^A-Za-z0-9+/]/g, '').length;
      return (base64Length * 3) >> 2;
    }
    return this.byteLengthUtf8(string);
  }
};

// Define the Buffer interface
interface BufferConstructor {
  from(data: string | ArrayBuffer | Uint8Array, encoding?: string): Uint8Array;
  alloc(size: number): Uint8Array;
  allocUnsafe(size: number): Uint8Array;
  isBuffer(obj: any): boolean;
  concat(list: Uint8Array[]): Uint8Array;
  isPolyfill: boolean;
  writeUInt32BE(buffer: Uint8Array, value: number, offset?: number): number;
  byteLength(string: string, encoding?: string): number;
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
  if (!window.Buffer) {
    console.log('Installing Buffer polyfill in window context');
    window.Buffer = safeBuffer as BufferConstructor;
  }
}

if (typeof global !== 'undefined') {
  if (!(global as any).Buffer) {
    console.log('Installing Buffer polyfill in global context');
    (global as any).Buffer = safeBuffer;
  }
}

export default safeBuffer;