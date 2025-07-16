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

// The database now stores a version number to handle global resets
async function initializeDatabase() {
    const client = await pool.connect();
    try {
        // Create table if it doesn't exist
        await client.query(`
            CREATE TABLE IF NOT EXISTS game_state (
                id INT PRIMARY KEY,
                play_count INT NOT NULL,
                game_version INT NOT NULL DEFAULT 1
            );
        `);
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

const items = ['🍔', '🏀', '⚾', '⚽', '🥎', '🏉', '🏈', '🏐', '🧶'];
const winnerMilestones = [3, 23, 73, 123, 173, 223];

// NEW ENDPOINT: The front-end will call this first to check the version
app.get('/status', async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT game_version FROM game_state WHERE id = 1');
        res.json({ version: result.rows[0].game_version });
    } catch (err) {
        res.status(500).json({ error: 'Could not get game status.' });
    } finally {
        client.release();
    }
});

app.post('/play', async (req, res) => {
    // ... (This logic is perfect, no changes needed)
    const client = await pool.connect(); try { const result = await client.query('UPDATE game_state SET play_count = play_count + 1 WHERE id = 1 RETURNING play_count'); const currentUserNumber = result.rows[0].play_count; let isWinner = winnerMilestones.includes(currentUserNumber); const shuffledItems = [...items].sort(() => Math.random() - 0.5); const burgerIndex = shuffledItems.indexOf('🍔'); const chosenBoxIndex = Math.floor(Math.random() * 9); if (isWinner) { [shuffledItems[chosenBoxIndex], shuffledItems[burgerIndex]] = [shuffledItems[burgerIndex], shuffledItems[chosenBoxIndex]]; } else { if (burgerIndex === chosenBoxIndex) { const swapIndex = (chosenBoxIndex + 1) % 9; [shuffledItems[chosenBoxIndex], shuffledItems[swapIndex]] = [shuffledItems[swapIndex], shuffledItems[chosenBoxIndex]]; } } let responsePayload = { win: isWinner, items: shuffledItems }; if (isWinner) { const part1 = Math.floor(Math.random() * 90) + 10; const part2 = Math.floor(Math.random() * 9000) + 1000; responsePayload.winnerCode = `${part1}5964${part2}`; } res.json(responsePayload); } catch (err) { console.error('GAME LOGIC ERROR:', err.stack); res.status(500).json({ error: 'Server could not process the game request.' }); } finally { client.release(); }
});

// THE TRUE RESET LINK: It now resets the count AND increments the version
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
app.listen(PORT, () => {
    console.log(`Cafe Rite Game Server starting on port ${PORT}...`);
    initializeDatabase();
});
