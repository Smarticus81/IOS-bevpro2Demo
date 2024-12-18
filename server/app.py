from flask import Flask, request, jsonify, send_file
import os
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

# Initialize OpenAI
# Initialize OpenAI with detailed logging
openai_api_key = os.getenv('OPENAI_API_KEY')
if not openai_api_key:
    logger.error("OpenAI API key not found")
    raise ValueError("OpenAI API key is required")

try:
    openai_client = OpenAI(api_key=openai_api_key)
    # Test the client with a simple request
    test_response = openai_client.audio.speech.create(
        model="tts-1",
        voice="nova",
        input="Test",
        response_format="mp3"
    )
    if test_response and test_response.content:
        logger.info("OpenAI client initialized and tested successfully")
    else:
        raise ValueError("OpenAI test response was empty")
except Exception as e:
    logger.error(f"Failed to initialize OpenAI client: {str(e)}")
    raise

@app.route('/api/settings/voice', methods=['GET'])
def get_voice_settings():
    try:
        return jsonify({
            'success': True,
            'config': {
                'provider': 'openai',
                'voiceEnabled': os.getenv('VOICE_ENABLED', 'true').lower() == 'true',
                'volume': float(os.getenv('VOICE_VOLUME', '1.0'))
            }
        })
    except Exception as e:
        logger.error(f"Error fetching voice settings: {str(e)}")
        return jsonify({'error': 'Failed to fetch voice settings'}), 500

@app.route('/api/settings/voice', methods=['POST'])
def update_voice_settings():
    try:
        data = request.json
        voice_enabled = data.get('voiceEnabled', True)
        volume = data.get('volume', 1.0)

        logger.info(f"Voice settings update request: {data}")

        os.environ['VOICE_ENABLED'] = str(voice_enabled).lower()
        os.environ['VOICE_VOLUME'] = str(volume)

        return jsonify({
            'success': True,
            'config': {
                'provider': 'openai',
                'voiceEnabled': voice_enabled,
                'volume': volume
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
        if not text:
            logger.error("No text provided in request")
            return jsonify({'error': 'Text is required'}), 400

        logger.info(f"Processing voice synthesis request: text='{text[:100]}...'")

        try:
            logger.info("Starting OpenAI voice synthesis")
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
            
            logger.info(f"Successfully generated audio with OpenAI Nova voice, content size: {len(response.content)} bytes")
            
            return send_file(
                audio_io,
                mimetype='audio/mpeg',
                as_attachment=True,
                download_name='speech.mp3'
            )

        except Exception as api_error:
            logger.error(f"OpenAI synthesis error: {str(api_error)}")
            raise

    except Exception as e:
        logger.error(f"Voice synthesis error: {str(e)}")
        return jsonify({
            'error': 'Voice synthesis failed',
            'message': str(e)
        }), 500

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
