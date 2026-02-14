import mongoose from 'mongoose';

/**
 * MongoDB Atlas Connection Configuration
 * 
 * Connects to MongoDB Atlas M0 free tier with proper error handling,
 * connection pooling, and automatic reconnection.
 */

const MONGODB_URI = process.env.MONGODB_URI;

// Connection options optimized for MongoDB Atlas M0 free tier
const options = {
    maxPoolSize: 10, // Limit connections for M0 tier
    minPoolSize: 2,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    family: 4, // Use IPv4, skip trying IPv6
};

let isConnected = false;

/**
 * Connect to MongoDB Atlas
 * @returns {Promise<void>}
 */
export async function connectMongoDB() {
    if (isConnected) {
        console.log('MongoDB: Already connected');
        return;
    }

    if (!MONGODB_URI) {
        throw new Error(
            'MONGODB_URI is not defined. Please set it in your .env file.\n' +
            'Get your connection string from: https://cloud.mongodb.com/ → Connect → Drivers → Node.js'
        );
    }

    try {
        await mongoose.connect(MONGODB_URI, options);
        isConnected = true;
        console.log('✅ MongoDB Atlas connected successfully');
        console.log(`   Database: ${mongoose.connection.name}`);
    } catch (error) {
        console.error('❌ MongoDB connection error:', error.message);
        throw error;
    }
}

/**
 * Disconnect from MongoDB
 * @returns {Promise<void>}
 */
export async function disconnectMongoDB() {
    if (!isConnected) {
        return;
    }

    try {
        await mongoose.disconnect();
        isConnected = false;
        console.log('MongoDB disconnected');
    } catch (error) {
        console.error('Error disconnecting from MongoDB:', error);
        throw error;
    }
}

// Handle connection events
mongoose.connection.on('connected', () => {
    console.log('Mongoose connected to MongoDB Atlas');
});

mongoose.connection.on('error', (err) => {
    console.error('Mongoose connection error:', err);
    isConnected = false;
});

mongoose.connection.on('disconnected', () => {
    console.log('Mongoose disconnected from MongoDB Atlas');
    isConnected = false;
});

// Graceful shutdown
process.on('SIGINT', async () => {
    await disconnectMongoDB();
    process.exit(0);
});

export default mongoose;
