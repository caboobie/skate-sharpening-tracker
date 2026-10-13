require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initDatabase() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS customers (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            team TEXT,
            position TEXT,
            notes TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
    )
            `);

            await pool.query(`
                CREATE TABLE IF NOT EXISTS sharpenings (
                    id SERIAL PRIMARY KEY,
                    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
                    sharpened_at DATE NOT NULL DEFAULT CURRENT_DATE,
                    hollow TEXT NOT NULL,
                    notes TEXT,
                    Price NUMERIC(6, 2)
                    )
                    `);

                    console.log('Database ready');
            }

app.get('/api/health', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');
        res.json({ ok: true, time: result.rows[0].now });
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false });
    }
});

const PORT = process.env.PORT || 3000;

async function start() {
    await initDatabase();

    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}

app.get('/api/customers', async (req, res) => {
    try {
        const search = req.query.search || '';
        const result = await pool.query(
            'SELECT * FROM customers WHERE name ILIKE $1 ORDER BY name',
            [`%${search}%`]
        );
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Something went wrong' });
    }
});

app.post('/api/customers', async (req, res) => {
    try {
        const { name, team, position, notes } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }

        const result = await pool.query(
            'INSERT INTO customers (name, team, position, notes) VALUES ($1, $2, $3, $4) RETURNING *',
            [name, team, position, notes]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Something went wrong' });
    }
});

app.post('/api/customers/:id/sharpenings', async (req, res) => {
    try {
        const { id } = req.params;
        const { hollow, sharpened_at, notes, price } = req.body;

        if (!hollow) {
            return res.status(400).json({ error: 'Hollow is required' });
        }

        const result = await pool.query(
            `INSERT INTO sharpenings (customer_id, hollow, sharpened_at, notes, price)
            VALUES ($1, $2, COALESCE($3, CURRENT_DATE), $4, $5)
            RETURNING *`,
            [id, hollow, sharpened_at, notes, price]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23503') {
            return res.status(404).json({ error: 'Customer not found' }); 
        }
        console.error(error);
        res.status(500).json({ error: 'Something went wrong' });
    }
});

app.get('/api/customers/:id/sharpenings', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM sharpenings WHERE customer_id = $1 ORDER BY sharpened_at DESC, id DESC',
            [req.params.id]
        );
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Something went wrong' });
    }
});

start();