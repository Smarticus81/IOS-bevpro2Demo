from flask import Flask, request, jsonify
import asyncio
from rasa.core.agent import Agent
from rasa.shared.utils.io import json_to_string
import os

app = Flask(__name__)
loop = asyncio.new_event_loop()
asyncio.set_event_loop(loop)

# Load the trained model
model_path = "./models"  # This will be the path to your trained model
agent = Agent.load(model_path)

@app.route("/webhooks/rest/webhook", methods=['POST'])
def webhook():
    try:
        # Get the message from the POST request
        message = request.json.get("message", "")
        sender_id = request.json.get("sender", "default")

        # Process message using Rasa
        response = loop.run_until_complete(
            agent.handle_text(
                text_message=message,
                sender_id=sender_id
            )
        )

        # Return the response
        return jsonify(response)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5005)
