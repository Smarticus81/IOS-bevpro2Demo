import OpenAI from "openai";

import { intentPredictor } from "./intent-prediction";
// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
let openai: OpenAI | null = null;

export async function getOpenAIClient(): Promise<OpenAI> {
  if (!openai) {
    try {
      console.log('Initializing OpenAI client...');
      const response = await fetch('/api/config');
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Config API error:', response.status, errorText);
        throw new Error(`Config API returned ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      if (!data.openaiKey) {
        console.error('OpenAI API key missing from server response');
        throw new Error('OpenAI API key not configured');
      }

      openai = new OpenAI({
        apiKey: data.openaiKey,
        dangerouslyAllowBrowser: true
      });

      // Test the client with a simple request
      const testResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "system", content: "Test connection" }],
        max_tokens: 5
      });

      console.log('OpenAI client initialized and tested successfully');
      return openai;
    } catch (error: any) {
      console.error('OpenAI client initialization failed:', error);
      openai = null; // Reset the client on failure
      throw new Error(error.message || 'Failed to initialize OpenAI client');
    }
  }
  return openai;
}

// OpenAI client setup and initialization only
let openai: OpenAI | null = null;

export async function getOpenAIClient(): Promise<OpenAI> {
  if (!openai) {
    try {
      console.log('Initializing OpenAI client...');
      const response = await fetch('/api/config');
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Config API error:', response.status, errorText);
        throw new Error(`Config API returned ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      if (!data.openaiKey) {
        console.error('OpenAI API key missing from server response');
        throw new Error('OpenAI API key not configured');
      }

      openai = new OpenAI({
        apiKey: data.openaiKey,
        dangerouslyAllowBrowser: true
      });

      // Test the client with a simple request
      const testResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "system", content: "Test connection" }],
        max_tokens: 5
      });

      console.log('OpenAI client initialized and tested successfully');
      return openai;
    } catch (error: any) {
      console.error('OpenAI client initialization failed:', error);
      openai = null; // Reset the client on failure
      throw new Error(error.message || 'Failed to initialize OpenAI client');
    }
  }
  return openai;
}