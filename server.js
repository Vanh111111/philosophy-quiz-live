const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;
const QUESTION_SECONDS = Number(process.env.QUESTION_SECONDS || 30);
const questions = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/questions.json'), 'utf8'));
const rooms = new Map();

app.set('trust proxy', 1);
app.use(express.static(path.join(__dirname, 'public')));
app.get('/api/health', (_, res) => res.json({ ok: true, questions: questions.length }));
app.get('/qr', async (req, res) => {
  try {
    const room = String(req.query.room || '').toUpperCase();
    const base = `${req.protocol}://${req.get('host')}`;
    res.type('png').send(await QRCode.toBuffer(`${base}/?room=${encodeURIComponent(room)}`, { width: 360, margin: 2 }));
  } catch { res.status(400).send('QR error'); }
});
function code() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
}
function clean(v) { return String(v || '').trim().replace(/[&lt;&gt;]/g, '').slice(0, 24); }
function publicQuestion(q) { return { number: q.number, question: q.question, options: q.options }; }
function snapshot(r) {
  const q = questions.find(x => x.number === r.current);
  return {
    code: r.code, status: r.status, current: r.current, total: questions.length,
    players: [...r.players.values()].map(p => ({ ...p })).sort((a, b) => b.score - a.score || b.correct - a.correct),
    question: r.status === 'question' && q ? { ...publicQuestion(q), endsAt: r.endsAt } : null,
    reveal: r.status === 'reveal' && q ? { ...publicQuestion(q), correct: q.correct || null, explanation: q.explanation || '' } : null
  };
}
function emit(r) { io.to(r.code).emit('room:update', snapshot(r)); }
function finishQuestion(r) {
  if (r.status !== 'question') return;
  clearTimeout(r.timer);
  r.status = 'reveal';
  const q = questions.find(x => x.number === r.current);
  io.to(r.code).emit('question:reveal', { number: q.number, correct: q.correct || null, results: [...r.answers.values()] });
  emit(r);
}
function startQuestion(r) {
  clearTimeout(r.timer);
  const q = questions.find(x => x.number === r.current);
  if (!q) { r.status = 'finished'; r.endsAt = null; emit(r); return; }
  r.answers.clear();
  for (const p of r.players.values()) p.answered = false;
  r.status = 'question';
  r.endsAt = Date.now() + QUESTION_SECONDS * 1000;
  emit(r);
  r.timer = setTimeout(() => finishQuestion(r), QUESTION_SECONDS * 1000);
}
io.on('connection', s => {
  s.on('host:create', () => {
    let c = code(); while (rooms.has(c)) c = code();
    const r = { code: c, hostId: s.id, status: 'lobby', current: 0, players: new Map(), answers: new Map(), timer: null, endsAt: null };
    rooms.set(c, r); s.join(c); s.data.room = c; s.data.role = 'host';
    s.emit('host:created', { code: c }); emit(r);
  });
  s.on('player:join', ({ roomCode, name } = {}) => {
    const r = rooms.get(String(roomCode || '').toUpperCase()), n = clean(name);
    if (!r) return s.emit('error:message', 'Không tìm thấy phòng thi.');
    if (r.status !== 'lobby') return s.emit('error:message', 'Phòng đã bắt đầu.');
    if (!n) return s.emit('error:message', 'Vui lòng nhập tên.');
    r.players.set(s.id, { id: s.id, name: n, score: 0, correct: 0, answered: false });
    s.join(r.code); s.data.room = r.code; s.data.role = 'player';
    s.emit('player:joined', { code: r.code, name: n }); emit(r);
  });
  s.on('host:start', ({ roomCode } = {}) => {
    const r = rooms.get(roomCode);
    if (!r || r.hostId !== s.id) return;
    if (!r.players.size) return s.emit('error:message', 'Cần ít nhất một người chơi.');
    r.current = questions[0].number; startQuestion(r);
  });
  s.on('player:answer', ({ answer } = {}) => {
    const r = rooms.get(s.data.room);
    if (!r || s.data.role !== 'player' || r.status !== 'question') return;
    const p = r.players.get(s.id), q = questions.find(x => x.number === r.current);
    if (!p || p.answered || !['A', 'B', 'C', 'D'].includes(answer)) return;
    p.answered = true;
    const elapsed = Date.now() - (r.endsAt - QUESTION_SECONDS * 1000);
    const remaining = Math.max(0, QUESTION_SECONDS * 1000 - elapsed);
    const correct = !!q.correct && answer === q.correct;
    const points = correct ? Math.round(500 + 500 * remaining / (QUESTION_SECONDS * 1000)) : 0;
    if (correct) { p.score += points; p.correct++; }
    r.answers.set(s.id, { id: s.id, name: p.name, answer, correct, points, elapsed });
    s.emit('answer:received', { correct, points });
    if (r.answers.size === r.players.size) finishQuestion(r); else emit(r);
  });
  s.on('host:next', ({ roomCode } = {}) => {
    const r = rooms.get(roomCode);
    if (!r || r.hostId !== s.id || r.status !== 'reveal') return;
    const index = questions.findIndex(q => q.number === r.current);
    r.current = questions[index + 1]?.number;
    startQuestion(r);
  });
  s.on('host:skip', ({ roomCode } = {}) => {
    const r = rooms.get(roomCode);
    if (!r || r.hostId !== s.id || !['question', 'reveal'].includes(r.status)) return;
    clearTimeout(r.timer); r.status = 'reveal'; emit(r);
  });
  s.on('host:finish', ({ roomCode } = {}) => {
    const r = rooms.get(roomCode);
    if (!r || r.hostId !== s.id) return;
    clearTimeout(r.timer); r.status = 'finished'; emit(r);
  });
  s.on('disconnect', () => {
    const r = rooms.get(s.data.room); if (!r) return;
    if (s.data.role === 'player') { r.players.delete(s.id); r.answers.delete(s.id); emit(r); }
  });
});
server.listen(PORT, () => console.log(`Quiz Arena listening on ${PORT}; ${questions.length} questions loaded`));
