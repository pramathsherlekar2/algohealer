import { createHmac, timingSafeEqual } from 'node:crypto';
import { deflateRawSync, inflateRawSync } from 'node:zlib';

const MAX_TOKEN_LENGTH = 3800;

export function encodeSignedState(state, secret) {
  if (!secret) throw new Error('DEMO_STATE_SECRET is required for stateless Vercel persistence.');
  const payload = deflateRawSync(Buffer.from(JSON.stringify(state))).toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  const token = `${payload}.${signature}`;
  if (token.length > MAX_TOKEN_LENGTH) throw new Error('Demo state exceeded the signed-cookie size limit. Reset the demo and retry.');
  return token;
}

export function decodeSignedState(token, secret) {
  if (!secret || typeof token !== 'string' || token.length > MAX_TOKEN_LENGTH) return null;
  const separator = token.lastIndexOf('.');
  if (separator < 1) return null;
  const payload = token.slice(0, separator);
  const providedSignature = Buffer.from(token.slice(separator + 1), 'base64url');
  const expectedSignature = createHmac('sha256', secret).update(payload).digest();
  if (providedSignature.length !== expectedSignature.length || !timingSafeEqual(providedSignature, expectedSignature)) return null;

  try {
    const json = inflateRawSync(Buffer.from(payload, 'base64url'), { maxOutputLength: 64 * 1024 }).toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}
