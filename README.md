# NexaCore — Run Locally

## Prerequisites
- Node.js
- MongoDB running locally (`mongod`)

## Setup

```bash
cd backend
npm install
```

Copy `.env.example` to `.env` and fill in these required fields:

```env
ADMIN_EMAIL=admin@nexacore.com
ADMIN_PASSWORD=your_password_here
JWT_SECRET=any_long_random_string
MONGO_URI=mongodb://127.0.0.1:27017/nexacore
```

## Run

```bash
npm start
```

Site → `http://localhost:3000`  
Admin → `http://localhost:3000/admin.html`

Login with the `ADMIN_EMAIL` and `ADMIN_PASSWORD` you set in `.env`.