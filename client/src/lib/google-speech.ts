import { speech_v1 } from '@google-cloud/speech';

export async function transcribeAudioGoogle(audioBuffer: ArrayBuffer): Promise<string> {
  const client = new speech_v1.SpeechClient();

  const audio = {
    content: Buffer.from(audioBuffer).toString('base64')
  };

  const config = {
    encoding: 'LINEAR16',
    sampleRateHertz: 16000,
    languageCode: 'en-US',
    model: 'command_and_search',
    useEnhanced: true
  };

  const request = {
    audio: audio,
    config: config
  };

  try {
    const [response] = await client.recognize(request);
    const transcription = response.results
      ?.map(result => result.alternatives?.[0]?.transcript)
      .filter(Boolean)
      .join('\n');
    
    return transcription || '';
  } catch (error) {
    console.error('Error transcribing audio:', error);
    throw new Error('Failed to transcribe audio with Google Speech API');
  }
}
