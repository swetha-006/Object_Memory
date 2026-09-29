# ObjectMemory — Full-Stack Local Rebuild

A clean-room local recreation inspired by the supplied ObjectMemory preview/screenshots. This version is a real full-stack app: React/Vite frontend + Express API + SQLite database + local document storage.

## Requirements
- Node.js 18+ (Node 20/22 recommended)
- VS Code

## Run
```bash
npm install
npm run dev
```
- Frontend: http://localhost:5173
- API: http://localhost:5000

If `npm run dev` is unavailable, use two terminals:
```bash
npm run server
npm run client
```

## Demo login
Email: `demo@objectmemory.local`
Password: `demo123`

## Included
- Login and registration
- JWT session authentication
- SQLite persistent database (`data/objectmemory.sqlite`)
- Dashboard and archive search
- Add/edit/delete objects
- Object detail page
- Condition tracking
- Damage notes / incident memory
- Timeline
- Document upload/open/delete (stored in `uploads/`)
- Ask AI chat per object, with conversation history stored in SQLite
- Local rule-based AI assistant; no paid AI key required
- Optional future integration point for a hosted LLM
- Settings and logout

## Database tables
`users`, `objects`, `events`, `documents`, `chat_messages`.

## Reset database
Stop the server and delete:
`data/objectmemory.sqlite`
Then start again. The demo user and sample object will be recreated.

## Notes
The project is a clean-room implementation, not the original Emergent source. The local assistant answers from stored object data and intentionally does not pretend to provide live market valuation or external facts.

## Market trend

The Object Detail → Market tab can query Google Shopping listings through SerpApi. The server stores each refresh as a dated SQLite snapshot and calculates the observed price trend from those real observations; it does not fabricate historical prices.

1. Copy `.env.example` to `.env`.
2. Add your `SERPAPI_KEY`.
3. Start the project with `npm run dev`.
4. Open an object that has a brand/model (or a clear object name).
5. Open **Market** and click **Refresh market**.

The first refresh creates the first observation. A trend percentage appears after observations from at least two different dates have been collected.
