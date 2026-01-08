from PIL import Image
import numpy as np

def remove_black_background(input_path, output_path):
    img = Image.open(input_path).convert("RGBA")
    data = np.array(img)
    
    # Define threshold for black
    threshold = 30
    
    # Create mask for black pixels (R, G, B all < threshold)
    black_mask = (data[:,:,0] < threshold) & (data[:,:,1] < threshold) & (data[:,:,2] < threshold)
    
    # Set alpha channel to 0 for black pixels
    data[black_mask, 3] = 0
    
    # Create new image from modified data
    new_img = Image.fromarray(data)
    new_img.save(output_path)
    print(f"Processed image saved to {output_path}")

if __name__ == "__main__":
    remove_black_background(
        "/home/ubuntu/edgeai-wallet-guide/client/public/images/logo.png",
        "/home/ubuntu/edgeai-wallet-guide/client/public/images/logo_transparent.png"
    )
