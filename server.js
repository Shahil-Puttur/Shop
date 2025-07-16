const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
    throw new Error('FATAL ERROR: DATABASE_URL environment variable is not set.');
}

const app = express();
app.use(cors()); // A simple CORS policy is sufficient and more stable.
app.use(express.json());

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function initializeDatabase() {
    const client = await pool.connect(); try { await client.query('CREATE TABLE IF NOT EXISTS game_state (id INT PRIMARY KEY, play_count INT NOT NULL);'); const res = await client.query('SELECT * FROM game_state WHERE id = 1'); if (res.rows.length === 0) { await client.query('INSERT INTO game_state (id, play_count) VALUES (1, 0)'); console.log('Database initialized successfully.'); } else { console.log('Database already initialized. Current count:', res.rows[0].play_count); } } catch (err) { console.error('DATABASE INITIALIZATION FAILED:', err.stack); } finally { client.release(); }
}

const items = ['🍔', '🏀', '⚾', '⚽', '🥎', '🏉', '🏈', '🏐', '🧶'];
const winnerMilestones = [3, 23, 73, 123, 173, 223];

app.get('/', (req, res) => res.send('<h1>Cafe Rite Backend is live!</h1>'));

app.post('/play', async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query('UPDATE game_state SET play_count = play_count + 1 WHERE id = 1 RETURNING play_count');
        const currentUserNumber = result.rows[0].play_count;
        let isWinner = winnerMilestones.includes(currentUserNumber);

        const shuffledItems = [...items].sort(() => Math.random() - 0.5);
        
        let responsePayload = { win: isWinner, items: shuffledItems };
        if (isWinner) {
            const part1 = Math.floor(Math.random() * 90) + 10;
            const part2 = Math.floor(Math.random() * 9000) + 1000;
            responsePayload.winnerCode = `${part1}5964${part2}`;
        }
        res.json(responsePayload);
    } catch (err) {
        console.error('GAME LOGIC ERROR:', err.stack);
        res.status(500).json({ error: 'Server could not process the game request.' });
    } finally {
        client.release();
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Cafe Rite Game Server starting on port ${PORT}...`);
    initializeDatabase();
});
