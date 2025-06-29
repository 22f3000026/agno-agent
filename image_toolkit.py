import os
import uuid
import requests
import openai
from agno.tools import Toolkit

class ImageGenerationToolkit(Toolkit):
    """
    Agno-compatible toolkit for DALL-E 3 image generation.
    Usage:
        toolkit = ImageGenerationToolkit(api_key="...", output_dir="generated_images")
        result = toolkit.generate_image(
            prompt="A beautiful sunset over mountains",
            aspect_ratio="1:1",
            size="1024x1024",
            quality="standard"
        )
        print(result)  # {'image_url': '...', 'image_path': '...', 'filename': '...'}
    """
    
    def __init__(self, api_key=None, output_dir="src/generated_images"):
        super().__init__(name="image_generation_toolkit")
        self.api_key = api_key or os.environ.get("OPENAI_API_KEY")
        if not self.api_key:
            raise ValueError("OpenAI API key is required. Set OPENAI_API_KEY environment variable or pass it to the constructor.")
        
        self.output_dir = output_dir
        os.makedirs(self.output_dir, exist_ok=True)
        
        # Register the main method
        self.register(self.generate_image)
    
    def generate_image(self, prompt, aspect_ratio="1:1", size="1024x1024", quality="standard"):
        """
        Generate an image using DALL-E 3
        
        Args:
            prompt (str): The text description of the image to generate
            aspect_ratio (str): Image aspect ratio (e.g., "1:1", "16:9", "3:4")
            size (str): Image size (e.g., "1024x1024", "1792x1024")
            quality (str): Image quality ("standard" or "hd")
            
        Returns:
            dict: Dictionary containing image_url, image_path, and filename
        """
        try:
            # Initialize OpenAI client
            client = openai.OpenAI(api_key=self.api_key)
            
            # Generate image using DALL-E 3
            response = client.images.generate(
                model="dall-e-3",
                prompt=prompt,
                size=size,
                quality=quality,
                n=1,
            )
            
            # Get the image URL
            image_url = response.data[0].url
            
            # Download and save the image
            image_response = requests.get(image_url)
            image_response.raise_for_status()
            
            # Generate unique filename
            filename = f"image_{uuid.uuid4().hex}.png"
            filepath = os.path.join(self.output_dir, filename)
            
            # Save image
            with open(filepath, "wb") as f:
                f.write(image_response.content)
            
            return {
                "image_url": image_url,
                "image_path": filepath,
                "filename": filename,
                "prompt": prompt,
                "aspect_ratio": aspect_ratio,
                "size": size,
                "quality": quality
            }
            
        except Exception as e:
            raise Exception(f"Image generation failed: {str(e)}")
    
    def generate_square_image(self, prompt, quality="standard"):
        """
        Generate a square image (1:1 aspect ratio)
        
        Args:
            prompt (str): The text description of the image to generate
            quality (str): Image quality ("standard" or "hd")
            
        Returns:
            dict: Dictionary containing image details
        """
        return self.generate_image(prompt, aspect_ratio="1:1", size="1024x1024", quality=quality)
    
    def generate_landscape_image(self, prompt, quality="standard"):
        """
        Generate a landscape image (16:9 aspect ratio)
        
        Args:
            prompt (str): The text description of the image to generate
            quality (str): Image quality ("standard" or "hd")
            
        Returns:
            dict: Dictionary containing image details
        """
        return self.generate_image(prompt, aspect_ratio="16:9", size="1792x1024", quality=quality)
    
    def generate_portrait_image(self, prompt, quality="standard"):
        """
        Generate a portrait image (3:4 aspect ratio)
        
        Args:
            prompt (str): The text description of the image to generate
            quality (str): Image quality ("standard" or "hd")
            
        Returns:
            dict: Dictionary containing image details
        """
        return self.generate_image(prompt, aspect_ratio="3:4", size="1024x1365", quality=quality) 