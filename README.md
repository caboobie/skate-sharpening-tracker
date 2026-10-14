# Skate Sharpening Tracker

A REST API for tracking ice skate sharpenings, including which hollow each customer uses. Over time it builds real data on hollow preferences by position.

## Tech stack

- Node.js and Express
- PostgreSQL (hosted on Railway)
- `pg` for database access, `dotenv` for configuration

## Setup

1. Install dependencies:
   ```
   npm install
   ```
2. Create a `.env` file with your Postgres connection URL (no quotes):
   ```
   DATABASE_URL=your_public_postgres_url
   ```
3. Start the server:
   ```
   node index.js
   ```
   The server runs on port 3000 by default (or `PORT` if set). Tables are created automatically on startup.

## Data model

**customers**: `id`, `name` (required), `team`, `position`, `notes`, `created_at`

**sharpenings**: `id`, `customer_id` (foreign key, cascades on delete), `sharpened_at` (date), `hollow` (required), `notes`, `price`

Allowed hollows: `3/8`, `7/16`, `1/2`, `9/16`, `5/8`, `11/16`, `3/4`

## API endpoints

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Checks the database connection |

### Customers

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/customers?search=term` | List customers, optionally filtered by name (case-insensitive) |
| POST | `/api/customers` | Create a customer. Body: `name` (required), `team`, `position`, `notes` |
| PUT | `/api/customers/:id` | Replace a customer's details. `name` is required |
| DELETE | `/api/customers/:id` | Delete a customer and their sharpenings |

### Sharpenings

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/customers/:id/sharpenings` | Log a sharpening. Body: `hollow` (required, must be an allowed value), `sharpened_at` (YYYY-MM-DD, defaults to today), `notes`, `price` |
| GET | `/api/customers/:id/sharpenings` | A customer's history, newest first. Dates are returned as `DD/MM/YYYY` in `sharpened_on` |
| DELETE | `/api/sharpenings/:id` | Delete a sharpening |

### Hollows and stats

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/hollows` | The list of allowed hollows |
| GET | `/api/stats/hollows` | Number of sharpenings per hollow, most common first |
| GET | `/api/stats/hollows-by-position` | Hollow counts grouped by customer position |

## Example

```
curl -X POST http://localhost:3000/api/customers \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Player","team":"Sharks","position":"Defence"}'

curl -X POST http://localhost:3000/api/customers/1/sharpenings \
  -H "Content-Type: application/json" \
  -d '{"hollow":"1/2","price":10}'
```

## Error handling

- `400`: invalid input (missing name, hollow not in the allowed list)
- `404`: customer or sharpening not found
- `500`: unexpected server error

## Design notes

- All queries are parameterised to prevent SQL injection.
- Hollows are validated server-side against a fixed list to keep the data consistent.
- Prices use `NUMERIC(6,2)` to avoid floating-point rounding errors.
- Dates are stored as `DATE` and formatted only for display.

## Roadmap

- React front end with a hollow picker
- Deploy to Railway
- Stats dashboard