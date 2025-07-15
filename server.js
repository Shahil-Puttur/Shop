const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

// Connect to your Render PostgreSQL database
// Render provides this URL in your database dashboard
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Function to initialize the database table if it doesn't exist
async function initializeDatabase() {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS game_state (
                id INT PRIMARY KEY,
                play_count INT NOT NULL
            );
        `);
        // Check if the counter row exists, if not, create it
        const res = await client.query('SELECT play_count FROM game_state WHERE id = 1');
        if (res.rows.length === 0) {
            await client.query('INSERT INTO game_state (id, play_count) VALUES (1, 0)');
            console.log('Database initialized.');
        }
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
        // Atomically increment the counter and get the new value
        const result = await client.query('UPDATE game_state SET play_count = play_count + 1 WHERE id = 1 RETURNING play_count');
        const currentUserNumber = result.rows[0].play_count;
        
        let isWinner = winnerMilestones.includes(currentUserNumber);
        
        // Shuffle items randomly
        const shuffledItems = [...items].sort(() => Math.random() - 0.5);

        // Place the burger based on win/loss
        const burgerIndex = shuffledItems.indexOf('🍔');
        const chosenBoxIndex = Math.floor(Math.random() * 9); // User's "choice"
        
        if (isWinner) {
            // If winner, place burger at the chosen spot
            [shuffledItems[chosenBoxIndex], shuffledItems[burgerIndex]] = [shuffledItems[burgerIndex], shuffledItems[chosenBoxIndex]];
        } else {
            // If loser, ensure burger is NOT at the chosen spot
            if (burgerIndex === chosenBoxIndex) {
                // Swap it with a different spot
                const swapIndex = (chosenBoxIndex + 1) % 9;
                [shuffledItems[chosenBoxIndex], shuffledItems[swapIndex]] = [shuffledItems[swapIndex], shuffledItems[chosenBoxIndex]];
            }
        }

        let responsePayload = {
            win: isWinner,
            items: shuffledItems
        };

        if (isWinner) {
            const part1 = Math.floor(Math.random() * 90) + 10; // Random 2 digits
            const part2 = Math.floor(Math.random() * 9000) + 1000; // Random 4 digits
            responsePayload.winnerCode = `${part1}5964${part2}`;
        }

        res.json(responsePayload);

    } catch (err) {
        console.error('Database transaction error', err.stack);
        res.status(500).send('Server error');
    } finally {
        client.release();
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    initializeDatabase().catch(console.error);
    console.log(`Cafe Rite Game Server running on port ${PORT}`);
});
