import tls from 'node:tls';

export interface SslResult {
  ok: boolean;
  expiresAt: Date | null;
}

/**
 * TLS handshake against :443 with the default CA store. ok=false covers
 * http-only sites, invalid/expired certs and unreachable hosts — all of which
 * surface the "Not secure" call hook.
 */
export function checkSsl(host: string, timeoutMs = 5_000): Promise<SslResult> {
  return new Promise((resolve) => {
    const socket = tls.connect({ host, port: 443, servername: host, timeout: timeoutMs });
    const done = (result: SslResult) => {
      socket.destroy();
      resolve(result);
    };
    socket.on('secureConnect', () => {
      const cert = socket.getPeerCertificate();
      const expiresAt = cert?.valid_to ? new Date(cert.valid_to) : null;
      done({ ok: socket.authorized, expiresAt });
    });
    socket.on('error', () => done({ ok: false, expiresAt: null }));
    socket.on('timeout', () => done({ ok: false, expiresAt: null }));
  });
}
