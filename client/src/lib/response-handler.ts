import { realtimeVoiceSynthesis } from './voice-realtime';

export async function handleAIResponse(intent: any) {
  try {
    // Extract the conversational response from the intent
    const response = intent.conversational_response;
    
    if (!response) {
      console.warn('No conversational response in intent:', intent);
      return;
    }

    console.log('Processing AI response:', { response });

    // Speak the response using our voice synthesis system
    await realtimeVoiceSynthesis.speak(response);

  } catch (error) {
    console.error('Error handling AI response:', error);
    throw error;
  }
}
