const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const multer = require('multer');
const { createWorker } = require('tesseract.js');
const fs = require('fs');

if (!process.env.DATABASE_URL) throw new Error('FATAL ERROR: DATABASE_URL is not set.');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const upload = multer({ dest: 'uploads/' }); // Temporary storage for screenshots

async function initializeDatabase() { /* ... unchanged ... */ }

const winnerMilestones = [5, 12, 22, 32, 42, 62, 82, 102, 132, 162, 192, 222, 272, 322, 372, 422, 472, 522, 572, 622, 672, 722, 772, 822, 872, 922, 972];

app.get('/', (req, res) => res.send('<h1>Cafe Rite Backend is live! V-LEGENDARY-FINAL</h1>'));
app.get('/viewers', async (req, res) => { /* ... unchanged ... */ });
app.post('/play', async (req, res) => { /* ... unchanged ... */ });
app.get('/reset-for-my-bro', async (req, res) => { /* ... unchanged ... */ });

// --- THE NEW "AI" VERIFICATION ENDPOINT ---
app.post('/verify-proof', upload.single('proof'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No screenshot uploaded.' });
    }

    const imagePath = req.file.path;
    let success = false;

    try {
        const worker = await createWorker('eng');
        const { data: { text } } = await worker.recognize(imagePath);
        await worker.terminate();

        const lowerCaseText = text.toLowerCase();
        console.log("OCR Result:", lowerCaseText); // For your debugging

        // The genius check
        if (lowerCaseText.includes('my status') && lowerCaseText.includes('cafe rite')) {
            success = true;
        }
    } catch (error) {
        console.error("OCR Error:", error);
        success = false;
    } finally {
        // THE ZERO-STORAGE FIX: Delete the file immediately.
        fs.unlinkSync(imagePath);
    }

    res.json({ success });
});

// Re-pasting full logic for completeness
async function initializeDatabase() { const client = await pool.connect(); try { await client.query('CREATE TABLE IF NOT EXISTS game_state (id INT PRIMARY KEY, play_count INT NOT NULL);'); const res = await client.query('SELECT * FROM game_state WHERE id = 1'); if (res.rows.length === 0) { await client.query('INSERT INTO game_state (id, play_count) VALUES (1, 0)'); } console.log('Database initialized successfully.'); } catch (err) { console.error('DATABASE INITIALIZATION FAILED:', err.stack); } finally { client.release(); } }
app.get('/viewers', async (req, res) => { const client = await pool.connect(); try { const result = await client.query('SELECT play_count FROM game_state WHERE id = 1'); const trueCount = result.rows.length > 0 ? result.rows[0].play_count : 0; res.json({ count: trueCount + 100 }); } catch (err) { res.status(500).json({ error: 'Could not get viewer count.' }); } finally { client.release(); } });
app.post('/play', async (req, res) => { const client = await pool.connect(); try { const result = await client.query('UPDATE game_state SET play_count = play_count + 1 WHERE id = 1 RETURNING play_count'); const currentUserNumber = result.rows[0].play_count; const isWinner = winnerMilestones.includes(currentUserNumber); const balls = ['🏀', '⚾', '⚽', '🥎', '🏉', '🏈', '🏐', '🧶']; const shuffledBalls = balls.sort(() => Math.random() - 0.5); let finalItems = new Array(9).fill(null); if (isWinner) { finalItems[req.body.boxIndex] = '🍔'; let ballIndex = 0; for (let i = 0; i < 9; i++) { if (finalItems[i] === null) { finalItems[i] = shuffledBalls[ballIndex++]; } } } else { finalItems[req.body.boxIndex] = shuffledBalls.pop(); let remainingSpots = []; for (let i = 0; i < 9; i++) { if (i !== req.body.boxIndex) remainingSpots.push(i); } const burgerSpot = remainingSpots[Math.floor(Math.random() * remainingSpots.length)]; finalItems[burgerSpot] = '🍔'; for (let i = 0; i < 9; i++) { if (finalItems[i] === null) { finalItems[i] = shuffledBalls.pop(); } } } let responsePayload = { win: isWinner, items: finalItems }; if (isWinner) { const part1 = Math.floor(Math.random() * 90) + 10; const part2 = Math.floor(Math.random() * 9000) + 1000; responsePayload.winnerCode = `${part1}5964${part2}`; } res.json(responsePayload); } catch (err) { console.error('GAME LOGIC ERROR:', err.stack); res.status(500).json({ error: 'Server could not process game request.' }); } finally { client.release(); } });
app.get('/reset-for-my-bro', async (req, res) => { const client = await pool.connect(); try { await client.query('UPDATE game_state SET play_count = 0 WHERE id = 1'); console.log('!!! GAME COUNTER HAS BEEN RESET TO 0 !!!'); res.status(200).send('<h1 style="font-family: sans-serif; color: green;">✅ GAME COUNTER RESET TO 0!</h1>'); } catch (err) { console.error('RESET FAILED:', err.stack); res.status(500).send('<h1>❌ Failed to reset counter.</h1>'); } finally { client.release(); } });

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => { console.log(`Cafe Rite Game Server is live and listening on port ${PORT}`); initializeDatabase(); });
