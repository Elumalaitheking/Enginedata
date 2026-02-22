# Engine Records Dashboard

Responsive full-stack app to store/search engine records with up to 10 images per engine.

## Stack
- Node.js + Express REST API
- MongoDB + Mongoose
- HTML/CSS/Vanilla JS frontend
- Multer local disk image storage (`/uploads`)

## Run
1. Install dependencies
   ```bash
   npm install
   ```
2. Copy env file
   ```bash
   cp .env.example .env
   ```
3. Start MongoDB locally (or update `MONGO_URI`).
4. Start server
   ```bash
   npm start
   ```
5. Open `http://localhost:3000`

## Features
- Create engine records (duplicate engine name blocked)
- Upload up to 10 images per engine
- Search by engine name
- Engine list with click-to-view details
- Image gallery + zoom modal
- Edit/delete engine records
- Delete individual images
