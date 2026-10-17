// Servidor sin dependencias: node server.js  ->  abre http://localhost:3000/host
const http = require('http'), fs = require('fs'), os = require('os'), path = require('path');
const PORT = 3100;

// Para agregar imágenes: copia el archivo a esta carpeta y añade una línea. fake: true = IA.
const IMAGES = [
  { src: '1.png', fake: false },
  { src: '2.png', fake: false },
  { src: '3.png', fake: true  },
  { src: '4.png', fake: true  },
  { src: '5.png', fake: false },
];

const lanIp = Object.values(os.networkInterfaces()).flat()
  .find(n => n.family === 'IPv4' && !n.internal)?.address || 'localhost';
const joinUrl = `http://${lanIp}:${PORT}/play`;

let phase, i, players; // phase: lobby | question | reveal | end
const reset = () => { phase = 'lobby'; i = 0; players = {}; };
reset();

const list = () => Object.entries(players);
const allAnswered = () => list().length > 0 && list().every(([, p]) => p.answers[i] !== undefined);

function results() {
  return list().map(([, p]) => {
    const wrong = IMAGES.map((_, j) => j).filter(j => p.answers[j] !== IMAGES[j].fake);
    return { name: p.name, score: IMAGES.length - wrong.length,
      missedAI: wrong.filter(j => IMAGES[j].fake).map(j => j + 1),    // era IA, dijo real
      missedReal: wrong.filter(j => !IMAGES[j].fake).map(j => j + 1) }; // era real, dijo IA
  }).sort((a, b) => b.score - a.score);
}

function state(id) {
  const s = { phase, joinUrl, total: IMAGES.length, i,
    players: list().map(([, p]) => ({ name: p.name, answered: p.answers[i] !== undefined })) };
  if (phase !== 'lobby' && phase !== 'end') s.src = IMAGES[i].src;
  if (id && players[id]) s.mine = players[id].answers[i];
  if (phase === 'reveal') {
    s.correct = IMAGES[i].fake;
    s.right = list().filter(([, p]) => p.answers[i] === IMAGES[i].fake).map(([, p]) => p.name);
  }
  if (phase === 'end') s.results = results();
  return s;
}

const json = (res, o, code = 200) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
const body = req => new Promise(r => { let d = ''; req.on('data', c => d += c); req.on('end', () => { try { r(JSON.parse(d || '{}')); } catch { r({}); } }); });
const pages = { '/': 'host.html', '/host': 'host.html', '/play': 'play.html' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'GET' && url.pathname === '/state') return json(res, state(url.searchParams.get('id')));

  if (req.method === 'POST') {
    const b = await body(req);
    if (url.pathname === '/join') {
      if (phase !== 'lobby') return json(res, { error: 'La partida ya empezó' }, 400);
      const name = String(b.name || '').trim().slice(0, 20);
      if (!name) return json(res, { error: 'Pon un nombre' }, 400);
      const id = Math.random().toString(36).slice(2);
      players[id] = { name, answers: [] };
      return json(res, { id });
    }
    if (url.pathname === '/answer') {
      if (phase === 'question' && players[b.id] && players[b.id].answers[i] === undefined) {
        players[b.id].answers[i] = !!b.fake;
        if (allAnswered()) phase = 'reveal';
      }
      return json(res, {});
    }
    if (url.pathname === '/host') {
      if (b.action === 'start' && phase === 'lobby' && list().length) phase = 'question';
      else if (b.action === 'reveal' && phase === 'question') phase = 'reveal';
      else if (b.action === 'next' && phase === 'reveal') { if (++i < IMAGES.length) phase = 'question'; else phase = 'end'; }
      else if (b.action === 'reset') reset();
      return json(res, {});
    }
    return json(res, {}, 404);
  }

  // estáticos: solo páginas y las imágenes de la lista
  const file = pages[url.pathname] || (IMAGES.some(m => '/' + m.src === url.pathname) && url.pathname.slice(1));
  if (!file) { res.writeHead(404); return res.end(); }
  const type = file.endsWith('.html') ? 'text/html; charset=utf-8' : 'image/' + path.extname(file).slice(1).replace('jpg', 'jpeg');
  fs.readFile(path.join(__dirname, file), (e, d) => { res.writeHead(e ? 404 : 200, { 'Content-Type': type }); res.end(d); });
}).listen(PORT, () => console.log(`Pantalla principal: http://localhost:${PORT}/host\nJugadores (QR): ${joinUrl}`));
