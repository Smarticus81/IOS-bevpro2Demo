import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { drinks, orders, orderItems } from "@db/schema";
import { eq, sql } from "drizzle-orm";
import { setupRealtimeProxy } from "./realtime-proxy";
import OpenAI from "openai";

const getOpenAIClient = async () => {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    throw new Error("OpenAI API key not configured");
  }
  return new OpenAI({ apiKey: openaiKey });
};

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);
  console.log('Setting up routes and realtime proxy...');
  setupRealtimeProxy(httpServer);

  // Get all drinks
  app.get("/api/drinks", async (_req, res) => {
    try {
      const allDrinks = await db.select().from(drinks);
      res.json(allDrinks);
    } catch (error) {
      console.error("Error fetching drinks:", error);
      res.status(500).json({ error: "Failed to fetch drinks" });
    }
  });

  // Create new order
  app.post("/api/orders", async (req, res) => {
    try {
      const { items, total } = req.body;
      
      // Create order
      const [order] = await db
        .insert(orders)
        .values({ total, items })
        .returning();

      // Create order items
      const orderItemsData = items.map((item: any) => ({
        order_id: order.id,
        drink_id: item.id,
        quantity: item.quantity,
        price: item.price
      }));

      await db.insert(orderItems).values(orderItemsData);

      // Update inventory and sales
      for (const item of items) {
        await db
          .update(drinks)
          .set({ 
            inventory: sql`${drinks.inventory} - ${item.quantity}`,
            sales: sql`COALESCE(${drinks.sales}, 0) + ${item.quantity}`
          })
          .where(eq(drinks.id, item.id));
      }

      res.json(order);
    } catch (error) {
      console.error("Error creating order:", error);
      res.status(500).json({ error: "Failed to create order" });
    }
  });

  // Get order by ID
  app.get("/api/orders/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const order = await db
        .select()
        .from(orders)
        .where(eq(orders.id, parseInt(id)))
        .limit(1);

      if (!order.length) {
        return res.status(404).json({ error: "Order not found" });
      }

      res.json(order[0]);
    } catch (error) {
      console.error("Error fetching order:", error);
      res.status(500).json({ error: "Failed to fetch order" });
    }
  });

  // Get API configuration
  app.get("/api/config", (_req, res) => {
    try {
      const openaiKey = process.env.OPENAI_API_KEY;
      const elevenLabsKey = process.env.ELEVEN_LABS_API_KEY;
      
      // Detailed logging for debugging
      console.log({
        hasOpenAIKey: !!openaiKey,
        hasElevenLabsKey: !!elevenLabsKey,
        openAIKeyLength: openaiKey?.length || 0,
        elevenLabsKeyLength: elevenLabsKey?.length || 0,
        timestamp: new Date().toISOString()
      });
      
      if (!openaiKey) {
        throw new Error("OpenAI API key not found in environment");
      }
      
      if (!openaiKey.startsWith('sk-')) {
        throw new Error("Invalid OpenAI API key format");
      }
      
      res.json({ 
        openaiKey,
        elevenLabsKey: !!elevenLabsKey  // Only send boolean indicating if key exists
      });
    } catch (error: unknown) {
      const err = error as Error;
      console.error("API config error:", {
        message: err.message,
        stack: err.stack,
        timestamp: new Date().toISOString()
      });
      
      res.status(500).json({
        error: "Configuration error",
        message: err.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Voice synthesis endpoint
  // Voice settings endpoint
  app.post("/api/settings/voice", async (req, res) => {
    try {
      const { provider, voiceEnabled, pitch, rate, volume, apiKey } = req.body;
      
      console.log('Voice settings update:', {
        provider,
        voiceEnabled,
        pitch,
        rate,
        volume,
        hasApiKey: !!apiKey,
        timestamp: new Date().toISOString()
      });

      // Validate provider
      if (!['elevenlabs', 'webspeech'].includes(provider)) {
        throw new Error('Invalid voice provider');
      }

      // If Eleven Labs is selected, validate and update API key
      if (provider === 'elevenlabs' && apiKey) {
        // Validate Eleven Labs API key format
        if (!apiKey.match(/^[a-zA-Z0-9]{32}$/)) {
          throw new Error('Invalid Eleven Labs API key format');
        }

        // Store the API key securely
        process.env.ELEVEN_LABS_API_KEY = apiKey;
      }

      // Return success response with current configuration
      res.json({
        success: true,
        config: {
          provider,
          voiceEnabled,
          pitch,
          rate,
          volume,
          hasElevenLabs: !!process.env.ELEVEN_LABS_API_KEY
        }
      });
    } catch (error: any) {
      console.error('Voice settings error:', {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      
      res.status(400).json({
        error: 'Failed to update voice settings',
        message: error.message
      });
    }
  });

  app.post("/api/synthesize", async (req, res) => {
    try {
      const { text, voice, speed, useElevenLabs } = req.body;
      
      console.log('Voice synthesis request:', {
        text,
        voice,
        speed,
        useElevenLabs,
        timestamp: new Date().toISOString()
      });
      
      if (!text) {
        return res.status(400).json({ error: "Text is required" });
      }

      const elevenLabsKey = process.env.ELEVEN_LABS_API_KEY;
      if (!elevenLabsKey) {
        throw new Error('Eleven Labs API key not configured');
      }

      console.log('Starting Eleven Labs synthesis:', {
        text: text.substring(0, 50) + '...',
        timestamp: new Date().toISOString()
      });

      // Using Rachel voice ID with enhanced settings
      const elevenLabsResponse = await fetch('https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM/stream', {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'xi-api-key': elevenLabsKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.0,
            use_speaker_boost: true
          },
          optimize_streaming_latency: 3
        })
      });

      if (!elevenLabsResponse.ok) {
        const errorText = await elevenLabsResponse.text();
        console.error('Eleven Labs API error:', {
          status: elevenLabsResponse.status,
          statusText: elevenLabsResponse.statusText,
          error: errorText,
          timestamp: new Date().toISOString()
        });
        throw new Error(`Eleven Labs API error: ${elevenLabsResponse.statusText} - ${errorText}`);
      }

      console.log('Successfully received response from Eleven Labs');
      const audioBuffer = await elevenLabsResponse.arrayBuffer();
      const buffer = Buffer.from(audioBuffer);
      
      console.log('Sending audio response:', {
        contentLength: buffer.length,
        timestamp: new Date().toISOString()
      });
      
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', buffer.length);
      res.send(buffer);
      
      console.log('Eleven Labs synthesis completed successfully:', {
        responseSize: buffer.length,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error occurred';
      console.error("Voice synthesis error:", {
        error: errorMessage,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      
      res.status(500).json({ 
        error: "Voice synthesis failed",
        message: errorMessage,
        timestamp: new Date().toISOString()
      });
    }
  });

  return httpServer;
}