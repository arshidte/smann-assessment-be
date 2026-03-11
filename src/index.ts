import express from 'express';
import cors from 'cors';
import geocodeRoutes, { geocodingErrorHandler } from './routes/geocodeRoutes';
import { startEvictionTimer } from './services/semanticCache';
import { createTrackingServer, broadcast } from './ws/trackingServer';
import { start as startSimulator } from './services/agentSimulator';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';

app.use(cors({ origin: FRONTEND_ORIGIN }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Register geocoding and address routes
app.use('/api', geocodeRoutes);

// Error handling middleware (must be after routes)
app.use(geocodingErrorHandler);

const server = app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
  startEvictionTimer();
  createTrackingServer(server);
  startSimulator(broadcast);
});

export { app, server };
