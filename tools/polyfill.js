// Apps Script no trae crypto.getRandomValues: se arma con UUIDs v4 (aleatorios seguros de Google).
if (typeof globalThis.crypto === 'undefined' || !globalThis.crypto.getRandomValues) {
  globalThis.crypto = {
    getRandomValues(arr) {
      let pool = [];
      for (let i = 0; i < arr.length; i++) {
        if (!pool.length) pool = Utilities.getUuid().replace(/-/g, '').replace(/^(.{12}).(.{3}).(.{15})$/, '$1$2$3').match(/../g).map((h) => parseInt(h, 16));
        arr[i] = pool.pop();
      }
      return arr;
    },
  };
}
if (typeof TextEncoder === 'undefined') {
  globalThis.TextEncoder = class { encode(s) { return Uint8Array.from(Utilities.newBlob(s).getBytes(), (b) => b & 255); } };
}
