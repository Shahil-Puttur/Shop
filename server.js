const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
    throw new Error('FATAL ERROR: DATABASE_URL environment variable is not set.');
}

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// The database now stores a version number to handle global resets.
async function initializeDatabase() {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS game_state (
                id INT PRIMARY KEY,
                play_count INT NOT NULL,
                game_version INT NOT NULL DEFAULT 1
            );
        `);
        // Add the new column if it doesn't exist (for backward compatibility)
        await client.query('ALTER TABLE game_state ADD COLUMN IF NOT EXISTS game_version INT NOT NULL DEFAULT 1').catch(e => console.log("Column game_version likely already exists."));
        
        const res = await client.query('SELECT * FROM game_state WHERE id = 1');
        if (res.rows.length === 0) {
            await client.query('INSERT INTO game_state (id, play_count, game_version) VALUES (1, 0, 1)');
            console.log('Database initialized successfully.');
        } else {
            console.log('Database already initialized.', res.rows[0]);
        }
    } catch (err) {
        console.error('DATABASE INITIALIZATION FAILED:', err.stack);
    } finally {
        client.release();
    }
}

const winnerMilestones = [3, 23, 73, 123, 173, 223, 273, 323, 373, 423, 473];

app.get('/', (req, res) => res.send('<h1>Cafe Rite Backend is live! V5 - The Legendary Version</h1>'));
app.get('/viewers', async (req, res) => { const client = await pool.connect(); try { const result = await client.query('SELECT play_count FROM game_state WHERE id = 1'); const trueCount = result.rows[0].play_count; res.json({ count: trueCount + 100 }); } catch (err) { res.status(500).json({ error: 'Could not get viewer count.' }); } finally { client.release(); } });

// --- THE NEW STATUS ENDPOINT ---
// The front-end calls this first to check the game version.
app.get('/status', async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT game_version FROM game_state WHERE id = 1');
        res.json({ version: result.rows[0].game_version || 1 });
    } catch (err) {
        res.status(500).json({ error: 'Could not get game status.' });
    } finally {
        client.release();
    }
});

// --- THE FLAWLESS WINNER LOGIC ---
app.post('/play', async (req, res) => {
    const { boxIndex } = req.body;
    if (boxIndex === undefined) return res.status(400).json({ error: 'Box index is required.' });

    const client = await pool.connect();
    try {
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

// --- THE TRUE RESET ENDPOINT ---
app.get('/reset-for-my-bro', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('UPDATE game_state SET play_count = 0, game_version = game_version + 1 WHERE id = 1');
        console.log('!!! GAME COUNTER AND VERSION HAS BEEN RESET !!!');
        res.status(200).send('<h1 style="font-family: sans-serif; color: green;">✅ GAME HAS BEEN COMPLETELY RESET FOR ALL USERS!</h1>');
    } catch (err) {
        console.error('RESET FAILED:', err.stack);
        res.status(500).send('<h1>❌ Failed to reset counter.</h1>');
    } finally {
        client.release();
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log(`Cafe Rite Game Server starting on port ${PORT}...`); initializeDatabase(); });
