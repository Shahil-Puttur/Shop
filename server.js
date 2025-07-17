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

// The database now has a table for fingerprints
async function initializeDatabase() {
    const client = await pool.connect();
    try {
        // Main counter table
        await client.query('CREATE TABLE IF NOT EXISTS game_state (id INT PRIMARY KEY, play_count INT NOT NULL);');
        let res = await client.query('SELECT * FROM game_state WHERE id = 1');
        if (res.rows.length === 0) {
            await client.query('INSERT INTO game_state (id, play_count) VALUES (1, 0)');
        }
        
        // Fingerprint table for 24-hour lock
        await client.query(`
            CREATE TABLE IF NOT EXISTS recent_plays (
                id SERIAL PRIMARY KEY,
                fingerprint VARCHAR(255) NOT NULL,
                timestamp TIMESTAMPTZ NOT NULL
            );
        `);
        console.log('Database initialized successfully.');
    } catch (err) {
        console.error('DATABASE INITIALIZATION FAILED:', err.stack);
    } finally {
        client.release();
    }
}

const winnerMilestones = [3, 23, 73, 123, 173, 223, 273, 323, 373, 423, 473];

app.get('/', (req, res) => res.send('<h1>Cafe Rite Backend is live! V-LEGENDARY</h1>'));

// --- THE UNBREAKABLE FINGERPRINT CHECK ---
app.post('/check', async (req, res) => {
    const { fingerprint } = req.body;
    if (!fingerprint) return res.status(400).json({ error: 'Fingerprint required.' });

    const client = await pool.connect();
    try {
        // Delete all old fingerprints automatically
        await client.query("DELETE FROM recent_plays WHERE timestamp < NOW() - INTERVAL '24 hours'");
        
        // Check if this fingerprint has played recently
        const result = await client.query('SELECT * FROM recent_plays WHERE fingerprint = $1', [fingerprint]);
        if (result.rows.length > 0) {
            return res.json({ canPlay: false });
        }
        return res.json({ canPlay: true });
    } catch(err) {
        console.error("Check error:", err);
        res.status(500).json({ error: 'Server error during check.' });
    } finally {
        client.release();
    }
});


// --- THE FLAWLESS WINNER LOGIC ---
app.post('/play', async (req, res) => {
    const { deviceId, boxIndex, fingerprint } = req.body;
    if (boxIndex === undefined || !fingerprint) {
        return res.status(400).json({ error: 'Box index and fingerprint are required.' });
    }

    const client = await pool.connect();
    try {
        // Double-check cooldown on the server to prevent cheating
        const checkResult = await client.query('SELECT * FROM recent_plays WHERE fingerprint = $1', [fingerprint]);
        if (checkResult.rows.length > 0) {
            return res.status(403).json({ error: 'This device has already played today.' });
        }
        
        // Log the play
        await client.query('INSERT INTO recent_plays (fingerprint, timestamp) VALUES ($1, NOW())', [fingerprint]);
        
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

// --- THE TRUE GLOBAL RESET ---
app.get('/reset-for-my-bro', async (req, res) => {
    const client = await pool.connect();
    try {
        // Reset BOTH the winner counter AND the device lock table
        await client.query('UPDATE game_state SET play_count = 0 WHERE id = 1');
        await client.query('DELETE FROM recent_plays');
        console.log('!!! TRUE GLOBAL RESET COMPLETE !!!');
        res.status(200).send('<h1 style="font-family: sans-serif; color: green;">✅ GAME HAS BEEN COMPLETELY RESET FOR ALL USERS!</h1>');
    } catch (err) {
        console.error('RESET FAILED:', err.stack);
        res.status(500).send('<h1>❌ Failed to reset counter.</h1>');
    } finally {
        client.release();
    }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Cafe Rite Game Server is live and listening on port ${PORT}`);
    initializeDatabase();
});
