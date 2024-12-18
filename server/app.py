from flask import Flask, request, jsonify, send_file
import os
from elevenlabs import generate, set_api_key
import io
from openai import OpenAI
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Initialize ElevenLabs
eleven_labs_key = os.getenv('ELEVEN_LABS_API_KEY')
if eleven_labs_key:
    set_api_key(eleven_labs_key)

# Initialize OpenAI
openai_client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

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
        text = data.get('text')
        provider = data.get('provider', 'openai')
        
        if not text:
            return jsonify({'error': 'Text is required'}), 400

        logger.info(f"Voice synthesis request: {text[:100]}... using {provider}")

        if provider == 'openai':
            try:
                response = openai_client.audio.speech.create(
                    model="tts-1",
                    voice="nova",
                    input=text
                )
                
                # Convert response content to file-like object
                audio_io = io.BytesIO(response.content)
                audio_io.seek(0)
                
                logger.info("Successfully generated audio with OpenAI")
                
                return send_file(
                    audio_io,
                    mimetype='audio/mpeg',
                    as_attachment=True,
                    download_name='speech.mp3'
                )
            except Exception as openai_error:
                logger.error(f"OpenAI synthesis failed: {str(openai_error)}")
                # Fall back to Eleven Labs if OpenAI fails
                if eleven_labs_key:
                    logger.info("Falling back to Eleven Labs")
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
