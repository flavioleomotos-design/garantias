const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = globalThis.prisma || new PrismaClient({ log: ['error'] });
globalThis.prisma = prisma;
const secret = process.env.AUTH_SECRET;
function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return body + '.' + sig;
}
function verify(token) {
  if (!secret || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const expected = crypto.createHmac('sha256', secret).update(parts[0]).digest();
  let actual;
  try { actual = Buffer.from(parts[1], 'base64url'); } catch { return null; }
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    if (!payload.sub || !payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch { return null; }
}
async function requireUser(req, res, minLevel = 3) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const payload = verify(token);
  if (!payload) { res.status(401).json({ status:'error', message:'Faça login para continuar.' }); return null; }
  try {
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.active || user.accessLevel > minLevel) {
      res.status(403).json({ status:'error', message:'Você não tem permissão para esta operação.' }); return null;
    }
    return user;
  } catch (error) {
    console.error('[auth] Falha ao consultar usuário no banco:', error.code || error.name);
    res.status(503).json({ status:'error', code:error.code || 'DATABASE_UNAVAILABLE', message:'Banco de dados temporariamente indisponível. Tente novamente em instantes.' });
    return null;
  }
}
function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return salt.toString('hex') + ':' + hash.toString('hex');
}
function checkPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [saltHex, hashHex] = stored.split(':');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), 64);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}
module.exports = { prisma, sign, verify, requireUser, hashPassword, checkPassword };