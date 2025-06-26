import os
from dotenv import load_dotenv
from elevenlabs import ElevenLabs

# Load environment variables from .env file
load_dotenv()

ELEVENLABS_API_KEY = os.environ.get("ELEVENLABS_API_KEY")

client = ElevenLabs(
    api_key="sk_60f65daa5f5e9ed35eb708ba62fe45f1edeb2bbbc345fbe5",
)

voice_id = "JBFqnCBsd6RMkjVDRZzb"
text = "The first move is what sets everything in motion."
model_id = "eleven_multilingual_v2"
output_format = "mp3_44100_128"

output_dir = "audio_generations"
os.makedirs(output_dir, exist_ok=True)
output_path = os.path.join(output_dir, "elevenlabs_direct_output.mp3")

# Generate audio and save to file
audio_bytes = client.text_to_speech.convert(
    voice_id=voice_id,
    output_format=output_format,
    text=text,
    model_id=model_id,
)

with open(output_path, "wb") as f:
    for chunk in audio_bytes:
        f.write(chunk)

print("Audio file path:", output_path)
print("Audio file name:", os.path.basename(output_path))