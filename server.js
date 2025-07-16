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

async function initializeDatabase() {
    // ... (This function is perfect, no changes needed)
    const client = await pool.connect(); try { await client.query('CREATE TABLE IF NOT EXISTS game_state (id INT PRIMARY KEY, play_count INT NOT NULL);'); const res = await client.query('SELECT play_count FROM game_state WHERE id = 1'); if (res.rows.length === 0) { await client.query('INSERT INTO game_state (id, play_count) VALUES (1, 0)'); console.log('Database initialized successfully.'); } else { console.log('Database already initialized. Current count:', res.rows[0].play_count); } } catch (err) { console.error('DATABASE INITIALIZATION FAILED:', err.stack); } finally { client.release(); }
}

const items = ['🍔', '🏀', '⚾', '⚽', '🥎', '🏉', '🏈', '🏐', '🧶'];
const winnerMilestones = [3, 23, 73, 123, 173, 223];

app.post('/play', async (req, res) => {
    // ... (This logic is perfect, no changes needed)
    const client = await pool.connect(); try { const result = await client.query('UPDATE game_state SET play_count = play_count + 1 WHERE id = 1 RETURNING play_count'); const currentUserNumber = result.rows[0].play_count; let isWinner = winnerMilestones.includes(currentUserNumber); const shuffledItems = [...items].sort(() => Math.random() - 0.5); const burgerIndex = shuffledItems.indexOf('🍔'); const chosenBoxIndex = Math.floor(Math.random() * 9); if (isWinner) { [shuffledItems[chosenBoxIndex], shuffledItems[burgerIndex]] = [shuffledItems[burgerIndex], shuffledItems[chosenBoxIndex]]; } else { if (burgerIndex === chosenBoxIndex) { const swapIndex = (chosenBoxIndex + 1) % 9; [shuffledItems[chosenBoxIndex], shuffledItems[swapIndex]] = [shuffledItems[swapIndex], shuffledItems[chosenBoxIndex]]; } } let responsePayload = { win: isWinner, items: shuffledItems }; if (isWinner) { const part1 = Math.floor(Math.random() * 90) + 10; const part2 = Math.floor(Math.random() * 9000) + 1000; responsePayload.winnerCode = `${part1}5964${part2}`; } res.json(responsePayload); } catch (err) { console.error('GAME LOGIC ERROR:', err.stack); res.status(500).json({ error: 'Server could not process the game request.' }); } finally { client.release(); }
});

// --- THE SECRET RESET LINK ---
// Visiting this URL in your browser will reset the counter to 0.
app.get('/reset-the-counter-for-my-bro-12345', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('UPDATE game_state SET play_count = 0 WHERE id = 1');
        console.log('!!! GAME COUNTER HAS BEEN RESET TO 0 via secret link!!!');
        res.status(200).send('<h1 style="font-family: sans-serif; color: green;">✅ GAME COUNTER RESET TO 0! You can now test from the beginning.</h1>');
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
