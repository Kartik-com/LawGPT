# LawGPT - Legal Practice Management System

A comprehensive legal practice management system built with React (frontend) and Node.js + MongoDB (backend).

## Features

- **Case Management**: Track cases, hearings, and deadlines
- **Client Management**: Manage client information and relationships
- **Document Management**: Upload, organize, and access case documents (powered by Cloudinary)
- **Invoicing**: Create and manage invoices for legal services
- **Calendar**: Schedule and track hearings and important dates
- **Alerts**: Get notified about upcoming deadlines and hearings
- **Time Tracking**: Log billable hours for cases
- **Activity Feed**: Track all system activities

## Tech Stack

### Frontend
- React 18 with Vite
- React Router for navigation
- Axios for API calls
- Modern UI with responsive design

### Backend
- Node.js with Express
- MongoDB Atlas (database)
- Cloudinary (file storage)
- JWT authentication
- Bcrypt for password hashing

## Prerequisites

- Node.js 16+ installed
- MongoDB Atlas account (free M0 tier)
- Cloudinary account (free tier)

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd LawGPT
```

### 2. Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file in the `backend` directory:

```bash
cp env.example .env
```

Edit `.env` and configure:

```env
# MongoDB Atlas Connection
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/lawgpt?retryWrites=true&w=majority

# JWT Secret (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
JWT_SECRET=your-random-32-character-secret-key

# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# CORS Origin
CORS_ORIGIN=http://localhost:8080

# Server Port
PORT=5000
```

**Get MongoDB Atlas URI**:
1. Go to [MongoDB Atlas](https://cloud.mongodb.com/)
2. Create a free cluster (M0)
3. Click "Connect" → "Drivers" → "Node.js"
4. Copy the connection string and replace `<password>` with your database password

**Get Cloudinary Credentials**:
1. Go to [Cloudinary Console](https://cloudinary.com/console)
2. Copy Cloud Name, API Key, and API Secret

Start the backend server:

```bash
npm run dev
```

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend will run on `http://localhost:8080`

## Project Structure

```
LawGPT/
├── backend/
│   ├── src/
│   │   ├── config/         # MongoDB, Cloudinary configuration
│   │   ├── models/         # Mongoose models
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic layer
│   │   ├── middleware/     # Auth and validation middleware
│   │   └── utils/          # Helper functions
│   ├── .env.example        # Environment template
│   └── index.js            # Server entry point
│
└── frontend/
    ├── src/
    │   ├── components/     # Reusable React components
    │   ├── pages/          # Page components
    │   └── App.jsx         # Main app component
    └── package.json
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout user

### Cases
- `GET /api/cases` - Get all cases
- `POST /api/cases` - Create new case
- `PUT /api/cases/:id` - Update case
- `DELETE /api/cases/:id` - Delete case

### Clients
- `GET /api/clients` - Get all clients
- `POST /api/clients` - Create new client
- `PUT /api/clients/:id` - Update client
- `DELETE /api/clients/:id` - Delete client

### Documents
- `GET /api/documents/files` - Get all documents
- `POST /api/documents/upload` - Upload documents
- `DELETE /api/documents/files/:id` - Delete document
- `GET /api/documents/folders` - Get all folders
- `POST /api/documents/folders` - Create folder

### Invoices, Hearings, Alerts, Time Entries
Similar CRUD endpoints available for each resource.

## Development

### Run Backend in Development Mode

```bash
cd backend
npm run dev  # Uses --watch flag for auto-restart
```

### Run Frontend in Development Mode

```bash
cd frontend
npm run dev
```

### Environment Variables

All sensitive configuration is managed through environment variables. Never commit `.env` files to version control.

## Deployment

### Backend Deployment (Railway/Render/Heroku)

1. Set environment variables in your deployment platform:
   - `MONGODB_URI`
   - `JWT_SECRET`
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
   - `CORS_ORIGIN` (your frontend URL)
   - `NODE_ENV=production`

2. Deploy the `backend` directory

### Frontend Deployment (Vercel/Netlify)

1. Build the frontend:
   ```bash
   npm run build
   ```

2. Deploy the `dist` folder

3. Update `CORS_ORIGIN` in backend to allow your frontend domain

## Security

- Passwords are hashed with bcrypt
- JWT tokens for authentication
- HTTP-only cookies for session management
- Input validation and sanitization
- Owner-scoped database queries (multi-user isolation)
- Cloudinary for secure file storage

## License

MIT License

## Support

For issues or questions, please open an issue on GitHub.
