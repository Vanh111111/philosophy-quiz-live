const socket = io();
const app = document.getElementById('app');
let role = '', roomCode = '', state = null, answered = false, clock = null, endsAt = 0;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[<>"']/g, c => ({
  '&':'&amp;',
  '<':'&lt;',
  '>':'&gt;',
  '"':'&quot;',
  "'":'&#39;'
}[c]));
function shell(content) {
  app.innerHTML = `&lt;div class="wrap"&gt;&lt;div class="top"&gt;&lt;div class="brand"&gt;PHILOSOPHY &lt;span&gt;QUIZ ARENA&lt;/span&gt;&lt;/div&gt;&lt;div class="tag"&gt;LIVE MULTIPLAYER&lt;/div&gt;&lt;/div&gt;${content}&lt;div class="footer"&gt;Triết học Mác - Lênin · Thi đấu trực tuyến&lt;/div&gt;&lt;/div&gt;`;
}
function home() {
  const room = new URLSearchParams(location.search).get('room') || '';
  shell(`&lt;div class="card center"&gt;&lt;div class="tag"&gt;THI ĐẤU TRỰC TIẾP&lt;/div&gt;&lt;h1&gt;QUIZ &lt;span style="color:#38bdf8"&gt;ARENA&lt;/span&gt;&lt;/h1&gt;&lt;p class="muted"&gt;Nhập mã phòng và tên để tham gia&lt;/p&gt;&lt;input id="room" placeholder="MÃ PHÒNG" maxlength="6" value="${esc(room)}"&gt;&lt;input id="name" placeholder="Tên người chơi" maxlength="24"&gt;&lt;button id="join" style="width:100%"&gt;VÀO PHÒNG THI&lt;/button&gt;&lt;p id="err" class="notice hidden"&gt;&lt;/p&gt;&lt;hr style="border-color:#2b3b59;margin:24px 0"&gt;&lt;button class="secondary" id="host"&gt;TẠO PHÒNG CHO MC&lt;/button&gt;&lt;/div&gt;`);
  $('#join').onclick = () => socket.emit('player:join', { roomCode: $('#room').value, name: $('#name').value });
  $('#host').onclick = () => { role = 'host'; socket.emit('host:create'); };
}
function board(players) {
  return `&lt;div class="card"&gt;&lt;div class="row between"&gt;&lt;h2&gt;🏆 BẢNG XẾP HẠNG&lt;/h2&gt;&lt;span class="pill"&gt;${players.length} NGƯỜI&lt;/span&gt;&lt;/div&gt;&lt;div class="list"&gt;${players.length ? players.map((p,i) => `&lt;div class="person"&gt;&lt;b&gt;${['🥇','🥈','🥉'][i] || '#'+(i+1)} ${esc(p.name)}&lt;/b&gt;&lt;span&gt;&lt;span class="muted"&gt;${p.correct} đúng&lt;/span&gt; &lt;span class="score"&gt;${p.score.toLocaleString('vi-VN')} đ&lt;/span&gt;&lt;/span&gt;&lt;/div&gt;`).join('') : "&lt;p class='muted'&gt;Chưa có người chơi.&lt;/p&gt;"}&lt;/div&gt;&lt;/div&gt;`;
}
function tick() {
  clearInterval(clock);
  const update = () => { const el = $('#timer'); if (!el) return; const n = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)); el.textContent = n; if (!n) clearInterval(clock); };
  update(); clock = setInterval(update, 200);
}
function answerLine(q) {
  if (!q.correct) return `&lt;p class="notice"&gt;Câu này chưa có đáp án được xác nhận trong dữ liệu nguồn, không tính điểm.&lt;/p&gt;`;
  const i = 'ABCD'.indexOf(q.correct);
  return `&lt;p class="correct-answer"&gt;ĐÁP ÁN: ${q.correct}. ${esc(q.options[i])}&lt;/p&gt;${q.explanation ? `&lt;p class="muted"&gt;${esc(q.explanation)}&lt;/p&gt;` : ''}`;
}
function hostView(s) {
  state = s;
  let content = '';
  if (s.status === 'lobby') content = `&lt;div class="card center"&gt;&lt;div class="tag"&gt;PHÒNG CHỜ&lt;/div&gt;&lt;h2&gt;MÃ PHÒNG&lt;/h2&gt;&lt;div class="bigcode"&gt;${s.code}&lt;/div&gt;&lt;img class="qr" src="/qr?room=${s.code}" alt="Mã QR tham gia"&gt;&lt;p class="muted"&gt;Thí sinh quét QR hoặc mở website và nhập mã phòng.&lt;/p&gt;&lt;p&gt;${s.players.length} thí sinh đã tham gia&lt;/p&gt;&lt;button id="start" ${s.players.length ? '' : 'disabled'}&gt;BẮT ĐẦU CUỘC THI&lt;/button&gt;&lt;/div&gt;${board(s.players)}`;
  if (s.status === 'question') {
    const q = s.question; endsAt = q.endsAt;
    content = `&lt;div class="card"&gt;&lt;div class="row between"&gt;&lt;span class="pill"&gt;CÂU ${q.number} · ${s.current}/${s.total}&lt;/span&gt;&lt;span class="timer" id="timer"&gt;&lt;/span&gt;&lt;/div&gt;&lt;h2&gt;${esc(q.question)}&lt;/h2&gt;&lt;div class="grid"&gt;${q.options.map((o,i) => `&lt;div class="option read-option"&gt;&lt;b&gt;${'ABCD'[i]}.&lt;/b&gt; ${esc(o)}&lt;/div&gt;`).join('')}&lt;/div&gt;&lt;p class="muted"&gt;Đã trả lời: ${s.players.filter(p=>p.answered).length}/${s.players.length}&lt;/p&gt;&lt;button class="danger" id="skip"&gt;BỎ QUA CÂU&lt;/button&gt;&lt;/div&gt;${board(s.players)}`;
  }
  if (s.status === 'reveal') {
    const q = s.reveal;
    content = `&lt;div class="card center"&gt;&lt;div class="tag"&gt;ĐÃ KHÓA ĐÁP ÁN&lt;/div&gt;&lt;h2&gt;Kết quả câu ${q.number}&lt;/h2&gt;${answerLine(q)}&lt;button id="next"&gt;CÂU TIẾP THEO →&lt;/button&gt; &lt;button class="danger" id="finish"&gt;KẾT THÚC&lt;/button&gt;&lt;/div&gt;${board(s.players)}`;
  }
  if (s.status === 'finished') content = `&lt;div class="card center"&gt;&lt;h1&gt;🏆 KẾT THÚC!&lt;/h1&gt;&lt;p&gt;Chúc mừng người chiến thắng.&lt;/p&gt;&lt;/div&gt;${board(s.players)}`;
  shell(content);
  if (s.status === 'lobby') $('#start').onclick = () => socket.emit('host:start', { roomCode: s.code });
  if (s.status === 'question') { tick(); $('#skip').onclick = () => socket.emit('host:skip', { roomCode: s.code }); }
  if (s.status === 'reveal') {
    $('#next').onclick = () => socket.emit('host:next', { roomCode: s.code });
    $('#finish').onclick = () => socket.emit('host:finish', { roomCode: s.code });
  }
}
function playerView(s) {
  state = s;
  const me = s.players.find(p => p.id === socket.id);
  let content = '';
  if (s.status === 'lobby') content = `&lt;div class="card center"&gt;&lt;div class="tag"&gt;ĐÃ VÀO PHÒNG ${s.code}&lt;/div&gt;&lt;h1&gt;Xin chào ${esc(me?.name || 'bạn')}!&lt;/h1&gt;&lt;p class="muted"&gt;Đang chờ MC bắt đầu.&lt;/p&gt;&lt;/div&gt;${board(s.players)}`;
  if (s.status === 'question') {
    const q = s.question; endsAt = q.endsAt;
    content = `&lt;div class="card"&gt;&lt;div class="row between"&gt;&lt;span class="pill"&gt;CÂU ${q.number} · ${s.current}/${s.total}&lt;/span&gt;&lt;span class="timer" id="timer"&gt;&lt;/span&gt;&lt;/div&gt;&lt;h2&gt;${esc(q.question)}&lt;/h2&gt;&lt;div class="grid"&gt;${q.options.map((o,i) => `&lt;button class="option" data-a="${'ABCD'[i]}" ${answered ? 'disabled' : ''}&gt;&lt;b&gt;${'ABCD'[i]}.&lt;/b&gt; ${esc(o)}&lt;/button&gt;`).join('')}&lt;/div&gt;&lt;p id="feedback" class="muted"&gt;${answered ? 'Đã gửi đáp án. Chờ kết quả!' : 'Chọn đáp án trước khi hết giờ.'}&lt;/p&gt;&lt;/div&gt;${board(s.players)}`;
  }
  if (s.status === 'reveal') content = `&lt;div class="card center"&gt;&lt;h2&gt;Kết quả câu ${s.reveal.number}&lt;/h2&gt;${answerLine(s.reveal)}&lt;p class="muted"&gt;Chờ MC chuyển câu tiếp theo.&lt;/p&gt;&lt;/div&gt;${board(s.players)}`;
  if (s.status === 'finished') content = `&lt;div class="card center"&gt;&lt;h1&gt;🏆 Cuộc thi kết thúc&lt;/h1&gt;&lt;p&gt;Điểm của bạn: &lt;b&gt;${me?.score || 0}&lt;/b&gt;&lt;/p&gt;&lt;/div&gt;${board(s.players)}`;
  shell(content);
  if (s.status === 'question') {
    tick();
    document.querySelectorAll('[data-a]').forEach(button => button.onclick = () => {
      if (answered) return;
      answered = true;
      document.querySelectorAll('[data-a]').forEach(x => x.disabled = true);
      button.classList.add('chosen');
      socket.emit('player:answer', { answer: button.dataset.a });
      $('#feedback').textContent = 'Đã ghi nhận. Chờ MC công bố!';
    });
  }
}
socket.on('host:created', data => { roomCode = data.code; role = 'host'; });
socket.on('player:joined', data => { roomCode = data.code; role = 'player'; answered = false; });
socket.on('room:update', s => {
  if (role === 'host') hostView(s);
  else if (role === 'player') {
    if (s.status === 'question' && (!state || state.current !== s.current || state.status !== 'question')) answered = false;
    playerView(s);
  }
});
socket.on('error:message', message => { const e = $('#err'); if (e) { e.textContent = message; e.classList.remove('hidden'); } else alert(message); });
socket.on('answer:received', data => { const f = $('#feedback'); if (f) f.textContent = data.correct ? `Chính xác! +${data.points} điểm` : 'Đã ghi nhận câu trả lời.'; });
home();
