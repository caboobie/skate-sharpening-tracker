require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const app = express();
const cors = require('cors');
app.use(express.json());
app.use(cors());



const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const HOLLOWS = [
    '3/8', '3/8 FIRE', '7/16', '1/2', '1/2 FIRE', '9/16', '5/8', '11/16', '3/4'];

const SHARPENING_COLUMNS = `
    id, customer_id, TO_CHAR(sharpened_at, 'DD/MM/YYYY') AS sharpened_on, hollow, notes, price
`;

const CUSTOMER_COLUMNS = `
    id, name, team, position, notes, created_at
`;

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
                    price NUMERIC(6, 2)
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

        if (!HOLLOWS.includes(hollow)) {
            return res.status(400).json({
                error: `Hollow must be one of: ${HOLLOWS.join(', ')}`
            });
        }

        const result = await pool.query(
            `INSERT INTO sharpenings (customer_id, hollow, sharpened_at, notes, price)
            VALUES ($1, $2, COALESCE($3, CURRENT_DATE), $4, $5)
            RETURNING ${SHARPENING_COLUMNS}`,
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
            `SELECT ${SHARPENING_COLUMNS} FROM sharpenings WHERE customer_id = $1 ORDER BY sharpenings.sharpened_at DESC, id DESC`,
            [req.params.id]
        );
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Something went wrong' });
    }
});

app.get('/api/hollows', (req, res) => {
    res.json(HOLLOWS);
});

// Most common hollows overall
app.get('/api/stats/hollows', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT hollow, COUNT(*)::int AS count
             FROM sharpenings
             GROUP BY hollow
             ORDER BY count DESC, hollow`
        );
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Something went wrong' });
    }
});

// Hollow counts broken down by position
app.get('/api/stats/hollows-by-position', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT COALESCE(c.position, 'Unknown') AS position,
                    s.hollow,
                    COUNT(*)::int AS count
             FROM sharpenings s
             JOIN customers c ON c.id = s.customer_id
             GROUP BY COALESCE(c.position, 'Unknown'), s.hollow
             ORDER BY position, count DESC, s.hollow`
        );
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Something went wrong' });
    }
});

app.delete('/api/sharpenings/:id', async (req, res) => {
    try {
        const result = await pool.query(
            `DELETE FROM sharpenings WHERE id = $1 RETURNING ${SHARPENING_COLUMNS}`,
            [req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Sharpening not found' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Something went wrong' });
    }
});

app.delete('/api/customers/:id', async (req, res) => {
    try {
        const result = await pool.query(
            `DELETE FROM customers WHERE id = $1 RETURNING ${CUSTOMER_COLUMNS}`,
            [req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Customer not found' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Something went wrong' });
    }
});

app.put('/api/customers/:id', async (req, res) => {
    try {
        const { name, team, position, notes } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }

        const result = await pool.query(
            `UPDATE customers 
            SET name = $1, team = $2, position = $3, notes = $4 WHERE id = $5 
            RETURNING ${CUSTOMER_COLUMNS}`,
            [name, team, position, notes, req.params.id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Customer not found' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Something went wrong' });
    }
});

app.get('/api/customers/:id', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT ${CUSTOMER_COLUMNS} FROM customers WHERE id = $1`,
            [req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Customer not found' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Something went wrong' });
    }
});

start();