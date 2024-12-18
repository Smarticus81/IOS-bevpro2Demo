import { realtimeVoiceSynthesis } from './voice-realtime';

export async function handleResponse(response: string) {
  try {
    if (!response) {
      console.warn('No response to handle');
      return;
    }

    console.log('Processing response:', { response });

    // Speak the response using our voice synthesis system
    await realtimeVoiceSynthesis.speak(response);

  } catch (error) {
    console.error('Error handling response:', error);
    throw error;
  }
}
