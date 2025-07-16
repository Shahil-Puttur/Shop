const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

// --- THE UNBREAKABLE FIX ---
// This code now checks for the DATABASE_URL. If it's missing, the server will crash on startup
// with a clear error message in your Render logs. This is a professional practice.
if (!process.env.DATABASE_URL) {
    throw new Error('FATAL ERROR: DATABASE_URL environment variable is not set. Please check your Render.com configuration.');
}

const app = express();
app.use(cors());
app.use(express.json());

// This configuration is now guaranteed to work with Render's PostgreSQL.
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Function to initialize the database table
async function initializeDatabase() {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS game_state (
                id INT PRIMARY KEY,
                play_count INT NOT NULL
            );
        `);
        const res = await client.query('SELECT play_count FROM game_state WHERE id = 1');
        if (res.rows.length === 0) {
            await client.query('INSERT INTO game_state (id, play_count) VALUES (1, 0)');
            console.log('Database initialized successfully.');
        } else {
            console.log('Database already initialized. Current count:', res.rows[0].play_count);
        }
    } catch (err) {
        console.error('DATABASE INITIALIZATION FAILED:', err.stack);
    } finally {
        client.release();
    }
}

const items = ['🍔', '🏀', '⚾', '⚽', '🥎', '🏉', '🏈', '🏐', '🧶'];
const winnerMilestones = [3, 23, 73, 123, 173, 223]; // Nth user is the winner

// --- The Main Game Endpoint ---
app.post('/play', async (req, res) => {
    const client = await pool.connect();
    try {
        // Atomically increment the counter and get the new value. This is race-condition-proof.
        const result = await client.query('UPDATE game_state SET play_count = play_count + 1 WHERE id = 1 RETURNING play_count');
        const currentUserNumber = result.rows[0].play_count;
        
        let isWinner = winnerMilestones.includes(currentUserNumber);
        
        const shuffledItems = [...items].sort(() => Math.random() - 0.5);
        const burgerIndex = shuffledItems.indexOf('🍔');
        const chosenBoxIndex = Math.floor(Math.random() * 9); // The box the user "chose"
        
        if (isWinner) {
            // If winner, place the burger at their chosen spot
            [shuffledItems[chosenBoxIndex], shuffledItems[burgerIndex]] = [shuffledItems[burgerIndex], shuffledItems[chosenBoxIndex]];
        } else {
            // If loser, make sure the burger is NOT at their chosen spot
            if (burgerIndex === chosenBoxIndex) {
                const swapIndex = (chosenBoxIndex + 1) % 9;
                [shuffledItems[chosenBoxIndex], shuffledItems[swapIndex]] = [shuffledItems[swapIndex], shuffledItems[chosenBoxIndex]];
            }
        }

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
