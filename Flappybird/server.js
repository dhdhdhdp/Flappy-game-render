// Flappy Bird API
// Start: npm install  ->  node server.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "data.json");

app.use(cors());
app.use(express.json());

// ---------- "Database" (data.json) ----------

function readData() {
    if (!fs.existsSync(DATA_FILE)) return [];
    const content = fs.readFileSync(DATA_FILE, "utf8");
    if (content.trim() === "") return [];
    return JSON.parse(content);
}

function writeData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// data.json: { Speler: { Naam, score, highscore, gamesPlayed, playTime } }
// The API returns flat objects (easier in C#):
// { naam, score, highscore, gamesPlayed, playTime }   (playTime in seconds)
function toPlayer(entry) {
    return {
        naam: entry.Speler.Naam,
        score: entry.Speler.score,
        highscore: entry.Speler.highscore,
        gamesPlayed: entry.Speler.gamesPlayed || 0,
        playTime: entry.Speler.playTime || 0
    };
}

function findEntry(data, naam) {
    return data.find(
        p => p.Speler.Naam.toLowerCase() === String(naam).toLowerCase()
    );
}

function parseScore(value) {
    const n = Number(value);
    return Number.isInteger(n) && n >= 0 ? n : null;
}

// ---------- Endpoints ----------

// Health check
app.get("/api", (req, res) => {
    res.json({ status: "ok", message: "Flappy Bird API" });
});

// All players
app.get("/api/players", (req, res) => {
    res.json(readData().map(toPlayer));
});

// Top players by highscore: /api/leaderboard?limit=10
app.get("/api/leaderboard", (req, res) => {
    const limit = parseInt(req.query.limit) || 10;
    const top = readData()
        .map(toPlayer)
        .sort((a, b) => b.highscore - a.highscore)
        .slice(0, limit);
    res.json(top);
});

// One player
app.get("/api/players/:naam", (req, res) => {
    const entry = findEntry(readData(), req.params.naam);
    if (!entry) return res.status(404).json({ error: "Speler niet gevonden" });
    res.json(toPlayer(entry));
});

// Save a score (new player or update existing one)
// Body: { "naam": "Dima", "score": 12, "playTime": 45 }   (playTime optional)
function saveScore(req, res) {
    const naam = (req.body.naam ?? req.body.name ?? "").toString().trim();
    const score = parseScore(req.body.score);

    if (!naam) return res.status(400).json({ error: "naam is verplicht" });
    if (score === null) return res.status(400).json({ error: "score moet een positief geheel getal zijn" });
    const playTime = req.body.playTime === undefined ? 0 : parseScore(req.body.playTime);
    if (playTime === null) return res.status(400).json({ error: "playTime moet een positief geheel getal zijn" });

    const data = readData();
    let entry = findEntry(data, naam);

    if (entry) {
        entry.Speler.score = score;
        if (score > entry.Speler.highscore) entry.Speler.highscore = score;
        entry.Speler.gamesPlayed = (entry.Speler.gamesPlayed || 0) + 1;
        entry.Speler.playTime = (entry.Speler.playTime || 0) + playTime;
    } else {
        entry = { Speler: { Naam: naam, score: score, highscore: score, gamesPlayed: 1, playTime: playTime } };
        data.push(entry);
    }

    writeData(data);
    res.json({ success: true, player: toPlayer(entry) });
}

app.post("/api/players", saveScore);
app.post("/save-score", saveScore); // old route (backwards compatible)

// Edit a player: change name and/or highscore
// Body: { "naam": "NieuweNaam", "highscore": 20 }
app.put("/api/players/:naam", (req, res) => {
    const data = readData();
    const entry = findEntry(data, req.params.naam);
    if (!entry) return res.status(404).json({ error: "Speler niet gevonden" });

    if (req.body.naam !== undefined) {
        const nieuweNaam = req.body.naam.toString().trim();
        if (!nieuweNaam) return res.status(400).json({ error: "naam mag niet leeg zijn" });
        const bestaand = findEntry(data, nieuweNaam);
        if (bestaand && bestaand !== entry) {
            return res.status(409).json({ error: "Deze naam bestaat al" });
        }
        entry.Speler.Naam = nieuweNaam;
    }
    for (const field of ["score", "highscore", "gamesPlayed", "playTime"]) {
        if (req.body[field] !== undefined) {
            const value = parseScore(req.body[field]);
            if (value === null) return res.status(400).json({ error: `${field} moet een positief geheel getal zijn` });
            entry.Speler[field] = value;
        }
    }

    writeData(data);
    res.json({ success: true, player: toPlayer(entry) });
});

// Delete a player
app.delete("/api/players/:naam", (req, res) => {
    const data = readData();
    const entry = findEntry(data, req.params.naam);
    if (!entry) return res.status(404).json({ error: "Speler niet gevonden" });

    writeData(data.filter(p => p !== entry));
    res.json({ success: true });
});

// Serve the game itself (public/index.html): http://localhost:3000/
app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => {
    console.log(`Server gestart op http://localhost:${PORT}`);
});
