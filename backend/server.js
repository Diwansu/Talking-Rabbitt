import express from 'express';
import cors from 'cors';
import apiRouter from './routes/api.js';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Mount the API router
app.use('/api', apiRouter);

if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`Talking Rabbitt API Server running on port ${port}`);
  });
}

export default app;