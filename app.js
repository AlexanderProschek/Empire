const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const QRCode = require("qrcode");

var Cache = require("ttl");
var cache = new Cache({
  ttl: 60 * 60 * 1000,
  capacity: 100,
});

app.use(express.static("public", { extensions: ["html"] }));

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

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
    admin: req.query.userId,
    gameId: generateGameId(),
    words: [],
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
  const { userId, gameId, question } = req.body;
  const game = cache.get(`game-${gameId}`);

  if (!game) return res.status(404).send("Game not found");

  if (game.admin !== userId)
    return res.status(403).send("You are not the admin of this game");

  game.question = question;
  cache.put(`game-${game.gameId}`, game);
  res.send("Success");
});

// General actions
app.get("/api/getQuestion", (req, res) => {
  const { gameId } = req.query;
  const game = cache.get(`game-${gameId}`);

  if (!game) return res.status(404).send("Game not found");

  res.json({ question: game.question });
});

app.post("/api/submitWord", (req, res) => {
  const { userId, gameId, word } = req.body;
  const game = cache.get(`game-${gameId}`);

  if (!game) return res.status(404).send("Game not found");

  game.words.push({ userId, word });
  cache.put(`game-${game.gameId}`, game);
  res.send("Success");
});

// Sudo actions
app.get("/api/getGame", (req, res) => {
  const game = cache.get(`game-${req.query.gameId}`);
  if (!game) return res.status(404).send("Game not found");

  res.json(game);
});

app.get("/api/allWords", (req, res) => {
  const game = cache.get(`game-${req.query.gameId}`);
  if (!game) return res.status(404).send("Game not found");

  res.json(game.words);
});

app.listen(process.env.PORT || 3000, () =>
  console.log("Listening on port 3000")
);
