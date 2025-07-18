const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
    throw new Error('FATAL ERROR: DATABASE_URL environment variable is not set.');
}

const app = express();
app.use(cors()); // A simple, robust CORS policy that works.
app.use(express.json());

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function initializeDatabase() {
    const client = await pool.connect();
    try {
        await client.query('CREATE TABLE IF NOT EXISTS game_state (id INT PRIMARY KEY, play_count INT NOT NULL);');
        await client.query(`CREATE TABLE IF NOT EXISTS recent_plays (id SERIAL PRIMARY KEY, fingerprint VARCHAR(255) UNIQUE NOT NULL, timestamp TIMESTAMPTZ NOT NULL);`);
        const res = await client.query('SELECT * FROM game_state WHERE id = 1');
        if (res.rows.length === 0) {
            await client.query('INSERT INTO game_state (id, play_count) VALUES (1, 0)');
        }
        console.log('Database initialized successfully.');
    } catch (err) {
        console.error('DATABASE INITIALIZATION FAILED:', err.stack);
    } finally {
        if (client) client.release();
    }
}

// --- THE NEW, CORRECTED WINNER LIST ---
const winnerMilestones = [
    5, 12, 22, 32, 42, 62, 82, 102, 132, 162, 192, 
    222, 272, 322, 372, 422, 472, 522, 572, 622, 672, 722, 
    772, 822, 872, 922, 972
];

// --- THE UPTIMEROBOT PROOF ---
app.get('/', (req, res) => {
    console.log(`Ping received at ${new Date().toISOString()}. Server is awake. ✅`);
    res.send('<h1>Cafe Rite Backend is live! V-LEGENDARY-FINAL</h1>');
});

app.get('/viewers', async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT play_count FROM game_state WHERE id = 1');
        const trueCount = result.rows.length > 0 ? result.rows[0].play_count : 0;
        res.json({ count: trueCount + 100 });
    } catch (err) {
        res.status(500).json({ error: 'Could not get viewer count.' });
    } finally {
        client.release();
    }
});

app.post('/play', async (req, res) => {
    const { boxIndex, fingerprint } = req.body;
    if (boxIndex === undefined || !fingerprint) {
        return res.status(400).json({ error: 'Box index and fingerprint are required.' });
    }

    const client = await pool.connect();
    try {
        await client.query("DELETE FROM recent_plays WHERE timestamp < NOW() - INTERVAL '24 hours'");
        const checkResult = await client.query('SELECT timestamp FROM recent_plays WHERE fingerprint = $1', [fingerprint]);
        if (checkResult.rows.length > 0) {
            const cooldownEnd = new Date(checkResult.rows[0].timestamp).getTime() + (24 * 60 * 60 * 1000);
            return res.status(429).json({ error: 'cooldown', cooldownEnd });
        }

        // --- THE "SILENT CRASH" FIX ---
        // This command will UPDATE the timestamp if the user somehow plays again, preventing a crash.
        await client.query(`
            INSERT INTO recent_plays (fingerprint, timestamp) VALUES ($1, NOW())
            ON CONFLICT (fingerprint) DO UPDATE SET timestamp = NOW()
        `, [fingerprint]);
        
        const result = await client.query('UPDATE game_state SET play_count = play_count + 1 WHERE id = 1 RETURNING play_count');
        const currentUserNumber = result.rows[0].play_count;
        const isWinner = winnerMilestones.includes(currentUserNumber);
        
        const balls = ['🏀', '⚾', '⚽', '🥎', '🏉', '🏈', '🏐', '🧶'];
        const shuffledBalls = balls.sort(() => Math.random() - 0.5);
        let finalItems = new Array(9).fill(null);

        if (isWinner) {
            finalItems[boxIndex] = '🍔';
            let ballIndex = 0;
            for (let i = 0; i < 9; i++) { if (finalItems[i] === null) { finalItems[i] = shuffledBalls[ballIndex++]; } }
        } else {
            finalItems[boxIndex] = shuffledBalls.pop();
            let remainingSpots = [];
            for (let i = 0; i < 9; i++) { if (i !== boxIndex) remainingSpots.push(i); }
            const burgerSpot = remainingSpots[Math.floor(Math.random() * remainingSpots.length)];
            finalItems[burgerSpot] = '🍔';
            for (let i = 0; i < 9; i++) { if (finalItems[i] === null) { finalItems[i] = shuffledBalls.pop(); } }
        }

        let responsePayload = { win: isWinner, items: finalItems };
        if (isWinner) {
            const part1 = Math.floor(Math.random() * 90) + 10;
            const part2 = Math.floor(Math.random() * 9000) + 1000;
            responsePayload.winnerCode = `${part1}5964${part2}`;
        }
        res.json(responsePayload);
    } catch (err) {
        console.error('GAME LOGIC ERROR:', err.stack);
        res.status(500).json({ error: 'Server could not process game request.' });
    } finally {
        client.release();
    }
});

app.get('/reset-for-my-bro', async (req, res) => {
    const client = await pool.connect(); try { await client.query('UPDATE game_state SET play_count = 0 WHERE id = 1'); await client.query('DELETE FROM recent_plays'); console.log('!!! TRUE GLOBAL RESET COMPLETE !!!'); res.status(200).send('<h1 style="font-family: sans-serif; color: green;">✅ GAME HAS BEEN COMPLETELY RESET FOR ALL USERS!</h1>'); } catch (err) { console.error('RESET FAILED:', err.stack); res.status(500).send('<h1>❌ Failed to reset counter.</h1>'); } finally { client.release(); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Cafe Rite Game Server is live and listening on port ${PORT}`);
    initializeDatabase();
});
