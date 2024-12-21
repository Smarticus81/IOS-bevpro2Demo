import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

interface VoiceOrderResult {
  success: boolean;
  order?: {
    items: Array<{
      name: string;
      quantity: number;
      customizations?: string[];
    }>;
    specialInstructions?: string;
  };
  error?: string;
}

export async function processVoiceOrder(audioBlob: Blob): Promise<VoiceOrderResult> {
  try {
    // Convert audio blob to base64
    // First, transcribe the audio
    const formData = new FormData();
    formData.append('file', audioBlob, 'voice-order.wav');
    formData.append('model', 'whisper-1');

    const transcription = await openai.audio.transcriptions.create({
      file: audioBlob,
      model: "whisper-1",
    });

    // Then, process the transcription with GPT-4 to understand the order
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a beverage order processing assistant. Extract order details from customer voice commands.
          Return a JSON object with the following structure:
          {
            "items": [
              {
                "name": "drink name",
                "quantity": number,
                "customizations": ["customization1", "customization2"]
              }
            ],
            "specialInstructions": "any special instructions"
          }`
        },
        {
          role: "user",
          content: transcription.text
        }
      ],
      response_format: { type: "json_object" }
    });

    const orderDetails = JSON.parse(completion.choices[0].message.content);

    return {
      success: true,
      order: orderDetails
    };

  } catch (error) {
    console.error('Error processing voice order:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process voice order'
    };
  }
}

export async function synthesizeOrderConfirmation(order: VoiceOrderResult['order']): Promise<string> {
  if (!order) return '';

  try {
    const response = await openai.audio.speech.create({
      model: "tts-1",
      voice: "nova",
      input: generateConfirmationMessage(order),
    });

    const audioUrl = URL.createObjectURL(new Blob([await response.arrayBuffer()]));
    return audioUrl;

  } catch (error) {
    console.error('Error synthesizing order confirmation:', error);
    throw error;
  }
}

function generateConfirmationMessage(order: VoiceOrderResult['order']): string {
  if (!order?.items.length) return "I couldn't understand your order. Could you please repeat that?";

  const itemDescriptions = order.items.map(item => {
    const customizations = item.customizations?.length 
      ? ` with ${item.customizations.join(', ')}`
      : '';
    return `${item.quantity} ${item.name}${customizations}`;
  }).join(', ');

  let message = `I've got your order: ${itemDescriptions}.`;
  if (order.specialInstructions) {
    message += ` Special instructions: ${order.specialInstructions}.`;
  }
  message += " Is this correct?";

  return message;
}
