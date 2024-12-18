from flask import Flask, request, jsonify, send_file
import os
from elevenlabs import generate, set_api_key
import io
from openai import OpenAI
import logging
import sys

# Configure detailed logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Initialize ElevenLabs
eleven_labs_key = os.getenv('ELEVEN_LABS_API_KEY')
if eleven_labs_key:
    try:
        set_api_key(eleven_labs_key)
        logger.info("ElevenLabs API initialized successfully with key starting with: %s", eleven_labs_key[:8])
    except Exception as e:
        logger.error("Failed to initialize ElevenLabs API: %s", str(e))
        raise
else:
    logger.warning("ElevenLabs API key not found")

# Initialize OpenAI
openai_api_key = os.getenv('OPENAI_API_KEY')
if not openai_api_key:
    logger.error("OpenAI API key not found")
    raise ValueError("OpenAI API key is required")

try:
    openai_client = OpenAI(api_key=openai_api_key)
    logger.info("OpenAI client initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize OpenAI client: {str(e)}")
    raise

@app.route('/api/settings/voice', methods=['GET'])
def get_voice_settings():
    try:
        return jsonify({
            'success': True,
            'config': {
                'provider': os.getenv('VOICE_PROVIDER', 'elevenlabs'),
                'voiceEnabled': os.getenv('VOICE_ENABLED', 'true').lower() == 'true',
                'pitch': float(os.getenv('VOICE_PITCH', '1.0')),
                'rate': float(os.getenv('VOICE_RATE', '1.0')),
                'volume': float(os.getenv('VOICE_VOLUME', '1.0')),
                'hasElevenLabs': bool(eleven_labs_key)
            }
        })
    except Exception as e:
        logger.error(f"Error fetching voice settings: {str(e)}")
        return jsonify({'error': 'Failed to fetch voice settings'}), 500

@app.route('/api/settings/voice', methods=['POST'])
def update_voice_settings():
    try:
        data = request.json
        provider = data.get('provider')
        voice_enabled = data.get('voiceEnabled')
        pitch = data.get('pitch')
        rate = data.get('rate')
        volume = data.get('volume')
        api_key = data.get('apiKey')

        logger.info(f"Voice settings update request: {data}")

        if provider not in ['elevenlabs', 'webspeech']:
            raise ValueError('Invalid voice provider')

        if provider == 'elevenlabs' and api_key:
            if not api_key.strip():
                raise ValueError('Invalid Eleven Labs API key')
            os.environ['ELEVEN_LABS_API_KEY'] = api_key
            set_api_key(api_key)

        os.environ['VOICE_PROVIDER'] = provider
        os.environ['VOICE_ENABLED'] = str(voice_enabled).lower()
        os.environ['VOICE_PITCH'] = str(pitch)
        os.environ['VOICE_RATE'] = str(rate)
        os.environ['VOICE_VOLUME'] = str(volume)

        return jsonify({
            'success': True,
            'config': {
                'provider': provider,
                'voiceEnabled': voice_enabled,
                'pitch': pitch,
                'rate': rate,
                'volume': volume,
                'hasElevenLabs': bool(eleven_labs_key)
            }
        })
    except Exception as e:
        logger.error(f"Voice settings error: {str(e)}")
        return jsonify({
            'error': 'Failed to update voice settings',
            'message': str(e)
        }), 400

@app.route('/api/synthesize', methods=['POST'])
def synthesize_speech():
    try:
        data = request.json
        logger.info(f"Received synthesis request data: {data}")
        
        text = data.get('text')
        provider = data.get('provider', 'openai')
        
        if not text:
            logger.error("No text provided in request")
            return jsonify({'error': 'Text is required'}), 400

        logger.info(f"Processing voice synthesis request: text='{text[:100]}...', provider={provider}")

        if provider == 'openai':
            try:
                logger.info("Attempting OpenAI voice synthesis")
                try:
                    response = openai_client.audio.speech.create(
                        model="tts-1",
                        voice="nova",
                        input=text,
                        response_format="mp3"
                    )
                    
                    if not response or not response.content:
                        raise ValueError("Empty response from OpenAI")
                    
                    logger.info("OpenAI synthesis successful, processing audio content")
                    # Convert response content to file-like object
                    audio_io = io.BytesIO(response.content)
                    audio_io.seek(0)
                    
                    if audio_io.getbuffer().nbytes == 0:
                        raise ValueError("Generated audio content is empty")
                        
                except Exception as api_error:
                    logger.error(f"OpenAI API error details: {str(api_error)}")
                    raise
                
                logger.info(f"Successfully generated audio with OpenAI, content size: {len(response.content)} bytes")
                
                return send_file(
                    audio_io,
                    mimetype='audio/mpeg',
                    as_attachment=True,
                    download_name='speech.mp3'
                )
            except Exception as openai_error:
                logger.error(f"OpenAI synthesis failed: {str(openai_error)}", exc_info=True)
                # Fall back to Eleven Labs if OpenAI fails
                if eleven_labs_key:
                    logger.info("Falling back to Eleven Labs due to OpenAI failure")
                    provider = 'elevenlabs'
                else:
                    raise openai_error

        if provider == 'elevenlabs':
            if not eleven_labs_key:
                return jsonify({'error': 'Eleven Labs API key not configured'}), 500

            # Using Rachel voice ID with enhanced settings
            audio = generate(
                text=text,
                voice="Rachel",
                model="eleven_multilingual_v2",
                optimize_streaming_latency=3
            )
            
            # Convert audio bytes to file-like object
            audio_io = io.BytesIO(audio)
            audio_io.seek(0)
            
            logger.info("Successfully generated audio with Eleven Labs")
            
            return send_file(
                audio_io,
                mimetype='audio/mpeg',
                as_attachment=True,
                download_name='speech.mp3'
            )

    except Exception as e:
        logger.error(f"Voice synthesis error: {str(e)}")
        return jsonify({
            'error': 'Voice synthesis failed',
            'message': str(e)
        }), 500

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
