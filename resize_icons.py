from PIL import Image
import os
import shutil

# Paths
artifact_path = r"C:\Users\eason\.gemini\antigravity\brain\b113b3ca-aa8e-4db5-971b-d71c81cd1c2e\app_icon_base.png"
output_dir = r"d:\aruu\chrome chat\icons"
sizes = [16, 48, 128]

def resize_icons():
    # Ensure output dir exists
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    # Check if artifact exists, if not, wait or error
    if not os.path.exists(artifact_path):
        print(f"Error: Archive file not found at {artifact_path}")
        # Try to find it in the current directory if it wasn't saved to absolute path
        # In this environment, we might need to rely on the agent to move it?
        # Actually, let's assume the agent will ensure the file is there or pass the path.
        exit(1)

    try:
        with Image.open(artifact_path) as img:
            # Save original for reference (optional)
            img.save(os.path.join(output_dir, "icon_original.png"))
            
            for size in sizes:
                # Resize with high quality resampling (LANCZOS)
                resized_img = img.resize((size, size), Image.Resampling.LANCZOS)
                output_path = os.path.join(output_dir, f"icon{size}.png")
                resized_img.save(output_path, "PNG")
                print(f"Saved: {output_path}")
                
            print("Successfully resized all icons.")
            
    except Exception as e:
        print(f"Failed to process image: {e}")
        exit(1)

if __name__ == "__main__":
    resize_icons()
