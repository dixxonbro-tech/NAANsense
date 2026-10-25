const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;
app.use(express.static(path.join(__dirname, "public")));

const MAX_PLAYERS = 8;
const ROUNDS = [
  { type: "trivia", title: "Flour Power", icon: "🌾", q: "Traditional naan is usually made with which flour?", options: ["Wheat flour", "Rice flour", "Almond flour", "Corn flour"], answer: 0, fact: "Traditional naan is usually wheat-based, and wheat contains gluten.", lesson: "Naan note" },
  { type: "kitchen", title: "Kitchen Detective", icon: "🧽", q: "You're preparing gluten-free flatbread. What is the safest next step?", options: ["Wipe crumbs with your hand", "Use clean tools and a clean surface", "Use the same flour-covered board", "Pick off visible crumbs"], answer: 1, fact: "Clean utensils and surfaces help prevent gluten cross-contact.", lesson: "Kitchen smart" },
  { type: "adventure", title: "Naan Dash", icon: "🫓", q: "A hungry naan is on a mission! Which ingredient is naturally gluten-free?", options: ["Barley", "Rye", "Rice", "Wheat"], answer: 2, fact: "Rice is naturally gluten-free, though packaged products can still have cross-contact.", lesson: "Ingredient scout" },
  { type: "trivia", title: "Gluten Know-How", icon: "🧠", q: "Which condition requires strict avoidance of gluten?", options: ["Celiac disease", "Near-sightedness", "Lactose intolerance", "Seasonal allergies"], answer: 0, fact: "Celiac disease is an autoimmune condition triggered by gluten.", lesson: "Gluten facts" },
  { type: "kitchen", title: "Label Lookout", icon: "🔎", q: "A friend needs gluten-free food. What should you do with a packaged ingredient?", options: ["Trust the color of the package", "Check the ingredient list and gluten-free label", "Assume all grains are safe", "Only check the calories"], answer: 1, fact: "Check labels carefully; gluten-free does not automatically mean dairy-free or low-calorie.", lesson: "Label legend" },
  { type: "adventure", title: "Flatbread Finale", icon: "🏆", q: "Which flour is made from chickpeas and is naturally gluten-free?", options: ["Semolina", "Rye flour", "Bread flour", "Gram flour (besan)"], answer: 3, fact: "Gram flour, also called besan, is made from chickpeas.", lesson: "Naan champion" }
];

function makeCode() { return crypto.randomBytes(3).toString("hex").toUpperCase(); }
function playersFor(room) {
  return [...room.players.values()].map(p => ({
    id: p.id, name: p.name, score: p.score, badges: p.badges,
    answered: room.answers.has(p.id), ready: !!p.ready
  })).sort((a,b) => b.score - a.score || a.name.localeCompare(b.name));
}
function emitPlayers(code) {
  const room = rooms.get(code);
  if (room) io.to(code).emit("players", { players: playersFor(room), phase: room.phase, hostId: room.host });
}
function publicRound(round, index) {
  return { index: index + 1, total: ROUNDS.length, type: round.type, title: round.title, icon: round.icon, q: round.q, options: round.options, seconds: 18 };
}
function startRound(code) {
  const room = rooms.get(code);
  if (!room || room.phase !== "playing") return;
  if (room.index >= ROUNDS.length) return finishGame(code);
  room.answers.clear();
  room.phase = "playing";
  room.roundStarted = Date.now();
  io.to(code).emit("round", publicRound(ROUNDS[room.index], room.index));
  emitPlayers(code);
  clearTimeout(room.timer);
  room.timer = setTimeout(() => revealRound(code), 18000);
}
function revealRound(code) {
  const room = rooms.get(code);
  if (!room || room.phase !== "playing") return;
  clearTimeout(room.timer);
  room.phase = "reveal";
  const round = ROUNDS[room.index];
  io.to(code).emit("reveal", {
    index: room.index + 1, correct: round.answer, answerText: round.options[round.answer],
    fact: round.fact, lesson: round.lesson, type: round.type, players: playersFor(room)
  });
  emitPlayers(code);
  room.timer = setTimeout(() => {
    if (!rooms.has(code)) return;
    room.index += 1;
    if (room.index >= ROUNDS.length) finishGame(code);
    else startRound(code);
  }, 5000);
}
function finishGame(code) {
  const room = rooms.get(code);
  if (!room) return;
  clearTimeout(room.timer);
  room.phase = "finished";
  const players = playersFor(room);
  io.to(code).emit("gameOver", { players, winner: players[0] || null });
  emitPlayers(code);
}
const rooms = new Map();

io.on("connection", socket => {
  socket.on("createRoom", ({name} = {}, done = () => {}) => {
    name = String(name || "").trim().slice(0, 18);
    if (!name) return done({error:"Choose a player name first."});
    let code; do { code = makeCode(); } while (rooms.has(code));
    const room = { host: socket.id, players: new Map(), phase:"lobby", index:0, answers:new Map(), timer:null };
    room.players.set(socket.id, {id:socket.id,name,score:0,badges:[],ready:true});
    rooms.set(code, room); socket.join(code); socket.data.roomCode = code;
    done({roomCode:code,host:true}); emitPlayers(code);
  });

  socket.on("joinRoom", ({roomCode,name} = {}, done = () => {}) => {
    roomCode = String(roomCode || "").trim().toUpperCase();
    name = String(name || "").trim().slice(0,18);
    const room = rooms.get(roomCode);
    if (!name) return done({error:"Choose a player name first."});
    if (!room) return done({error:"That room code wasn't found. Check it and try again."});
    if (room.phase !== "lobby") return done({error:"This adventure has already started."});
    if (room.players.size >= MAX_PLAYERS) return done({error:`This room is full (${MAX_PLAYERS} players max).`});
    room.players.set(socket.id,{id:socket.id,name,score:0,badges:[],ready:true});
    socket.join(roomCode); socket.data.roomCode = roomCode;
    done({roomCode,host:false}); emitPlayers(roomCode);
  });

  socket.on("startGame", () => {
    const code = socket.data.roomCode, room = rooms.get(code);
    if (!room || room.host !== socket.id || room.phase !== "lobby" || room.players.size < 2) return;
    room.index = 0; room.players.forEach(p => {p.score=0;p.badges=[];});
    room.phase = "playing"; startRound(code);
  });

  socket.on("answer", ({choice} = {}) => {
    const code = socket.data.roomCode, room = rooms.get(code);
    if (!room || room.phase !== "playing" || room.answers.has(socket.id)) return;
    const player = room.players.get(socket.id);
    if (!player || !Number.isInteger(choice) || choice < 0 || choice > 3) return;
    room.answers.set(socket.id, choice);
    const round = ROUNDS[room.index], correct = choice === round.answer;
    const remaining = Math.max(0, 18000 - (Date.now() - room.roundStarted));
    const points = correct ? 100 + Math.round(remaining / 18000 * 50) : 0;
    if (correct) {
      player.score += points;
      player.badges.push(round.type === "kitchen" ? "Kitchen Keeper" : round.type === "adventure" ? "Naan Navigator" : "Fact Finder");
    }
    socket.emit("answerResult",{correct,choice,correctChoice:round.answer,points});
    emitPlayers(code);
    if (room.answers.size >= room.players.size) revealRound(code);
  });

  socket.on("disconnect", () => {
    const code = socket.data.roomCode, room = rooms.get(code);
    if (!room) return;
    room.players.delete(socket.id); room.answers.delete(socket.id);
    if (!room.players.size) { clearTimeout(room.timer); rooms.delete(code); return; }
    if (room.host === socket.id) room.host = room.players.keys().next().value;
    emitPlayers(code);
    if (room.phase === "playing" && room.answers.size >= room.players.size) revealRound(code);
  });
});

server.listen(PORT, () => console.log(`NAANsense listening on ${PORT}`));
