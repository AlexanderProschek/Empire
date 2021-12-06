const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");

const QRCode = require("qrcode");
const WebSocket = require("ws");

var Cache = require("ttl");
var cache = new Cache({
  ttl: 60 * 60 * 1000,
});

const wsServer = new WebSocket.Server({ noServer: true });

app.use(express.static("public", { extensions: ["html"] }));

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());

const generateGameId = () => {
  const validCharacters = "abcdefghijklmnopqrstuvwxyz0123456789";
  let gameId = "";
  for (let i = 0; i < 5; i++) {
    gameId += validCharacters.charAt(
      Math.floor(Math.random() * validCharacters.length)
    );
  }
  return gameId;
};

// Admin actions
app.get("/api/newGame", async (req, res) => {
  let game = {
    admin: req.cookies.userId,
    gameId: generateGameId(),
    answers: [],
    question: null,
  };

  cache.put(`game-${game.gameId}`, game);

  let gameQR = await QRCode.toDataURL(
    `http://${process.env.HOST || "localhost"}:${
      process.env.PORT || 3000
    }/join?gameId=${game.gameId}`
  );

  res.json({ gameId: game.gameId, gameQR });
});

app.post("/api/setQuestion", (req, res) => {
  const { gameId, question } = req.body;
  const { userId } = req.cookies;
  const game = cache.get(`game-${gameId}`);

  if (!game) return res.status(404).send("Game not found");

  if (game.admin !== userId)
    return res.status(403).send("You are not the admin of this game");

  game.question = question;
  cache.put(`game-${game.gameId}`, game);
  res.send("Success");
});

app.get("/api/listAnswers", (req, res) => {
  const { gameId } = req.query;
  const { userId } = req.cookies;
  const game = cache.get(`game-${gameId}`);

  if (!game) return res.status(404).send("Game not found");

  if (game.admin !== userId)
    return res.status(403).send("You are not the admin of this game");

  cache.del(`game-${gameId}`);

  res.json(game.answers.map((a) => a.answer).sort(() => Math.random() - 0.5));
});

// General actions
app.get("/api/getQuestion", (req, res) => {
  const { gameId } = req.query;
  const game = cache.get(`game-${gameId}`);

  if (!game) return res.status(404).send("Game not found");

  res.json({ question: game.question });
});

app.post("/api/submitAnswer", (req, res) => {
  const { gameId, answer } = req.body;
  const { userId } = req.cookies;
  const game = cache.get(`game-${gameId}`);

  if (!game) return res.status(404).send("Game not found");

  game.answers = game.answers.filter((a) => a.userId !== userId);

  game.answers.push({ userId, answer });
  cache.put(`game-${game.gameId}`, game);
  res.send("Success");
});

app.get("/api/hasAnswered", (req, res) => {
  const { gameId } = req.query;
  const { userId } = req.cookies;
  const game = cache.get(`game-${gameId}`);

  if (!game) return res.status(404).send("Game not found");

  const answer = game.answers.find((a) => a.userId === userId);

  res.json({ hasAnswered: !!answer });
});

// Sudo actions
app.get("/api/getGame", (req, res) => {
  const game = cache.get(`game-${req.query.gameId}`);
  if (!game) return res.status(404).send("Game not found");

  res.json(game);
});

app.get("/api/allAnswers", (req, res) => {
  const game = cache.get(`game-${req.query.gameId}`);
  if (!game) return res.status(404).send("Game not found");

  res.json(game.answers);
});

const server = app.listen(process.env.PORT || 3000, () =>
  console.log("Listening on port 3000")
);

server.on("upgrade", (request, socket, head) => {
  wsServer.handleUpgrade(request, socket, head, (socket) => {
    wsServer.emit("connection", socket, request);
  });
});

// WebSocket actions
wsServer.on("connection", (ws, req) => {
  let gameId = "";

  ws.on("message", (message) => {
    message = JSON.parse(message);

    if (message.gameId) {
      gameId = message.gameId;
      const game = cache.get(`game-${gameId}`);
      if (game) {
        ws.send(
          JSON.stringify({
            numAnswers: game.answers.length,
            question: game.question,
          })
        );
      }
    }
  });

  cache.on("put", function (key, val, _ttl) {
    if (key === `game-${gameId}`) {
      ws.send(
        JSON.stringify({
          numAnswers: val.answers.length,
          question: val.question,
        })
      );
    }
  });
});
