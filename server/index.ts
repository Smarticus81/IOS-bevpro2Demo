import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { db, sql } from "@db";

const app = express();

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// CORS middleware for development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  // Capture the response for logging
  let capturedResponse: any;
  const originalJson = res.json;
  res.json = function(body) {
    capturedResponse = body;
    return originalJson.call(this, body);
  };

  res.on('finish', () => {
    const duration = Date.now() - start;
    if (path.startsWith('/api')) {
      const logData = {
        method: req.method,
        path,
        status: res.statusCode,
        duration: `${duration}ms`,
        response: capturedResponse
      };
      log(`API ${JSON.stringify(logData)}`);
    }
  });

  next();
});

// Function to test database connection
async function testDatabaseConnection() {
  try {
    await db.execute(sql`SELECT NOW()`);
    log('Database connection successful');
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

(async () => {
  try {
    // Test database connection with retries
    let connected = false;
    for (let i = 0; i < 3 && !connected; i++) {
      connected = await testDatabaseConnection();
      if (!connected && i < 2) {
        log(`Retrying database connection... (attempt ${i + 2}/3)`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    if (!connected) {
      throw new Error('Failed to connect to database after 3 attempts');
    }

    // Register API routes and get the server instance
    const server = registerRoutes(app);

    // Error handling middleware
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      console.error('Error:', err);
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({ 
        error: message,
        timestamp: new Date().toISOString()
      });
    });

    // Setup Vite or static serving
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // Start server on port 5000
    const PORT = 5000;
    server.listen(PORT, "0.0.0.0", () => {
      log(`Server running on port ${PORT} (http://0.0.0.0:${PORT})`);
    }).on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        log(`Port ${PORT} is in use, shutting down`);
        process.exit(1);
      } else {
        console.error('Server error:', err);
        process.exit(1);
      }
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();