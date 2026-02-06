from PIL import Image, ImageDraw, ImageFilter, ImageFont
import os

# Configuration
OUTPUT_DIR = r"d:\aruu\chrome chat\icons"
SIZES = [16, 48, 128]
BRAND_COLOR = "#9F7AEA"
BG_COLOR = "#FFFFFF"

def draw_icon(size):
    # Higher resolution for antialiasing
    scale = 4
    s = size * scale
    
    # Create main image
    img = Image.new("RGBA", (s, s), (0,0,0,0))
    draw = ImageDraw.Draw(img)
    
    # 1. Rounded Square Background (White)
    padding = s * 0.05
    rect_coords = [padding, padding, s - padding, s - padding]
    radius = s * 0.2
    draw.rounded_rectangle(rect_coords, radius=radius, fill=BG_COLOR)
    
    # 2. Chat Bubble (Purple)
    # Centered, slightly smaller
    bubble_w = s * 0.6
    bubble_h = s * 0.5
    bx = (s - bubble_w) / 2
    by = (s - bubble_h) / 2
    
    # Draw bubble body
    draw.rounded_rectangle([bx, by, bx + bubble_w, by + bubble_h], radius=bubble_h*0.4, fill=BRAND_COLOR)
    
    # Draw bubble tail (bottom left)
    tail_coords = [
        (bx + bubble_w * 0.15, by + bubble_h * 0.8), # Start inside
        (bx - bubble_w * 0.1, by + bubble_h * 1.1),  # Tip
        (bx + bubble_w * 0.4, by + bubble_h * 0.9)   # End inside
    ]
    draw.polygon(tail_coords, fill=BRAND_COLOR)

    # 3. White Spark/Star
    # Center of bubble
    cx = s / 2
    cy = s / 2
    spark_radius = s * 0.15
    spark_color = "#FFFFFF"
    
    # Draw a 4-pointed star
    # Vertical bar
    draw.rounded_rectangle([cx - s*0.02, cy - spark_radius, cx + s*0.02, cy + spark_radius], radius=s*0.02, fill=spark_color)
    # Horizontal bar
    draw.rounded_rectangle([cx - spark_radius, cy - s*0.02, cx + spark_radius, cy + s*0.02], radius=s*0.02, fill=spark_color)
    
    # Resize down
    img = img.resize((size, size), Image.Resampling.LANCZOS)
    return img

def main():
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)
        
    for size in SIZES:
        try:
            icon = draw_icon(size)
            output_path = os.path.join(OUTPUT_DIR, f"icon{size}.png")
            icon.save(output_path, "PNG")
            print(f"Generated: {output_path}")
        except Exception as e:
            print(f"Error generating {size}x{size}: {e}")

if __name__ == "__main__":
    main()
