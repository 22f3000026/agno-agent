import os
from elevenlabs import ElevenLabs

class ElevenLabsToolkit:
    """
    Agno-compatible toolkit for ElevenLabs TTS.
    Usage:
        toolkit = ElevenLabsToolkit(api_key="...", output_dir="audio_generations")
        result = toolkit.text_to_speech(
            text="Hello world",
            voice_id="JBFqnCBsd6RMkjVDRZzb",
            model_id="eleven_multilingual_v2",
            output_format="mp3_44100_128",
            filename="output.mp3"
        )
        print(result)  # {'audio_file': 'audio_generations/output.mp3', 'audio_file_name': 'output.mp3'}
    """
    def __init__(self, api_key=None, output_dir="audio_generations"):
        self.api_key = api_key or os.environ.get("ELEVEN_LABS_API_KEY")
        self.output_dir = output_dir
        os.makedirs(self.output_dir, exist_ok=True)
        self.client = ElevenLabs(api_key=self.api_key)

    def text_to_speech(self, text, voice_id, model_id, output_format="mp3_44100_128", filename="output.mp3"):
        output_path = os.path.join(self.output_dir, filename)
        audio_bytes = self.client.text_to_speech.convert(
            voice_id=voice_id,
            output_format=output_format,
            text=text,
            model_id=model_id,
        )
        with open(output_path, "wb") as f:
            for chunk in audio_bytes:
                f.write(chunk)
        return {
            "audio_file": output_path,
            "audio_file_name": os.path.basename(output_path)
        }