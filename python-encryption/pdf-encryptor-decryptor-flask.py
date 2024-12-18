import json
import base64
import hashlib
from flask import Flask, request, jsonify, send_file
from io import BytesIO
import zipfile
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from PyPDF2 import PdfReader, PdfWriter
from bin.keygen import gen_key  # Custom module to generate encryption keys
from bin import *  # Import encryption and decryption functions

app = Flask(__name__)

# Helper function: Create SHA-256 hash of PDF content
def create_sha256_hash(pdf_content):
    sha256_hash = hashlib.sha256()
    sha256_hash.update(pdf_content)
    return sha256_hash.hexdigest()

# Helper function: Verify if the hash matches the PDF file's hash
def verify_pdf_hash(pdf_content, stored_hash):
    pdf_hash = create_sha256_hash(pdf_content)
    return pdf_hash == stored_hash

# Helper function: Extract salts from passphrases
def extract_salt(passphrases):
    return [passphrase[1::2] if len(passphrase) % 2 == 0 else passphrase[0::2] for passphrase in passphrases]

# Helper function: Add a watermark to the PDF
def add_watermark_to_pdf(pdf_data, watermark_text, color_hex, opacity, font, size, angle, rows, columns):
    packet = BytesIO()
    can = canvas.Canvas(packet, pagesize=letter)
    color = colors.HexColor(color_hex)
    can.setFillColor(color, opacity / 100.0)
    
    # Page dimensions
    page_width, page_height = letter
    can.setFont(font, size)
    
    # Calculate precise spacing for grid alignment
    x_spacing = page_width / columns  # Width of each column
    y_spacing = page_height / rows    # Height of each row
    
    # Adjust for centering watermark within the grid cell
    text_offset_x = -size * len(watermark_text) / 4  # Adjust text center horizontally
    text_offset_y = -size / 2                       # Adjust text center vertically
    
    # Place watermarks at evenly spaced grid positions
    for row in range(rows):
        for col in range(columns):
            x = col * x_spacing + (x_spacing / 2)  # Center horizontally in column
            y = page_height - (row * y_spacing + (y_spacing / 2))  # Center vertically in row
            can.saveState()
            can.translate(x, y)
            can.rotate(angle)
            can.drawString(text_offset_x, text_offset_y, watermark_text)
            can.restoreState()
    
    can.save()
    packet.seek(0)

    # Merge watermark with the existing PDF pages
    existing_pdf = PdfReader(BytesIO(pdf_data))
    output = PdfWriter()
    watermark_pdf = PdfReader(packet)
    watermark_page = watermark_pdf.pages[0]
    
    for i in range(len(existing_pdf.pages)):
        page = existing_pdf.pages[i]
        page.merge_page(watermark_page)
        output.add_page(page)
    
    output_stream = BytesIO()
    output.write(output_stream)
    
    return output_stream.getvalue()


# Encrypt PDF data
def encrypt_pdf(pdf_data, algorithms, all_passphrases, all_salts):
    nonces = []
    hash_data = create_sha256_hash(pdf_data)

    for algo, passphrase, salt in zip(algorithms, all_passphrases, all_salts):
        if algo in ('aes128', 'aes256', 'aesgcm', 'blowfish', 'arc4', 'chacha20poly1305', 'des3', 'rc4', 'salsa20', 'xchacha20'):
            nonce_length = {'aes128': 12, 'aes256': 12, 'aesgcm': 12, 'blowfish': 4,
                            'arc4': 8, 'chacha20poly1305': 12, 'des3': 4, 'rc4': 8,
                            'salsa20': 8, 'xchacha20': 24}.get(algo, 12)
            key = gen_key(algo, passphrase, salt)
            encryption_function = globals().get(f"{algo}_encrypt")
            pdf_data, nonce = encryption_function(pdf_data, key, nonce_length)
            nonces.append(base64.b64encode(nonce).decode('utf-8'))
        else:
            raise ValueError(f"Unknown algorithm: {algo}")

    return pdf_data, nonces, hash_data

# Decrypt PDF data
def decrypt_pdf(pdf_data, nonces_data, hash, algorithms, all_passphrases, all_salts):
    for algo, nonce_b64, passphrase, salt in zip(reversed(algorithms), reversed(nonces_data), reversed(all_passphrases), reversed(all_salts)):
        nonce = base64.b64decode(nonce_b64.encode('utf-8'))
        key = gen_key(algo, passphrase, salt)
        decrypt_function = globals().get(f"{algo}_decrypt")
        if not decrypt_function:
            raise ValueError(f"Unknown algorithm: {algo}")
        pdf_data = decrypt_function(pdf_data, key, nonce)

    return pdf_data if verify_pdf_hash(pdf_data, hash) else None

# Flask route to handle PDF encryption requests
@app.route('/encrypt', methods=['POST'])
def encrypt():
    if 'original_pdf' not in request.files:
        return jsonify({"error": "No files provided"}), 400

    pdf_file = request.files.getlist('original_pdf')[0]
    pdf_data = pdf_file.read()
    
    json_data = request.form.get('data')
    if not json_data:
        return jsonify({"error": "No JSON data provided"}), 400
    try:
        json_data = json.loads(json_data)
    except json.JSONDecodeError:
        return jsonify({"error": "Invalid JSON data"}), 400

    selected_algos = json_data["selected_algos"]
    all_passphrases = json_data["all_passphrases"]
    filename = json_data["filename"]
    all_salts = extract_salt(all_passphrases)
    
    pdf_data, nonces, hash_data = encrypt_pdf(pdf_data, selected_algos, all_passphrases, all_salts)
    
    zip_buffer = BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w') as zip_file:
        zip_file.writestr(f"encrypted.enc", pdf_data)
        zip_file.writestr(f"encrypted.nonces.json", json.dumps(nonces))
        zip_file.writestr(f"encrypted.hash", json.dumps(hash_data))
    
    zip_buffer.seek(0)
    return send_file(zip_buffer, mimetype='application/zip', as_attachment=True, download_name=f'{filename}_encrypted_files.zip')

# Flask route to handle PDF decryption requests
@app.route('/decrypt', methods=['POST'])
def decrypt():
    # Option 1: Check if the user uploaded a ZIP file
    if 'encrypted_files.zip' in request.files:
        zip_file = request.files['encrypted_files.zip']
        
        # Try to extract files from the uploaded ZIP
        try:
            with zipfile.ZipFile(BytesIO(zip_file.read()), 'r') as zip_ref:
                # Extract required files from ZIP archive
                encrypted_data = zip_ref.read('encrypted.enc')  # Encrypted data
                nonces_data = json.loads(zip_ref.read('encrypted.nonces.json').decode('utf-8'))  # Nonces for decryption
                hash_data = zip_ref.read('encrypted.hash').decode('utf-8').strip('"').strip()  # Hash for file integrity
        except (KeyError, zipfile.BadZipFile, json.JSONDecodeError):
            # Return an error if the ZIP file is invalid or required files are missing
            return jsonify({"error": "Invalid ZIP file or missing required files"}), 400

    # Option 2: Check if individual files were uploaded
    elif all(file_key in request.files for file_key in ['encrypted.enc', 'encrypted.nonces.json', 'encrypted.hash']):
        # Read individual uploaded files
        encrypted_data = request.files['encrypted.enc'].read()
        try:
            nonces_data = json.loads(request.files['encrypted.nonces.json'].read().decode('utf-8'))  # Nonces for decryption
        except json.JSONDecodeError:
            # Return an error if the nonces file contains invalid JSON
            return jsonify({"error": "Invalid JSON format in nonces file"}), 400
        
        hash_data = request.files['encrypted.hash'].read().decode('utf-8').strip('"').strip()  # Hash for file integrity
    
    else:
        # Return error if neither a ZIP file nor the required individual files are provided
        return jsonify({"error": "Please upload either 'encrypted_files.zip' or all required files (encrypted.enc, encrypted.nonces.json, encrypted.hash)"}), 400

    # Parse JSON data containing decryption parameters
    json_data = request.form.get('data')
    if not json_data:
        # Return error if no JSON data is provided
        return jsonify({"error": "No JSON data provided"}), 400
    try:
        json_data = json.loads(json_data)
    except json.JSONDecodeError:
        # Return error if the JSON data is invalid
        return jsonify({"error": "Invalid JSON data"}), 400

    # Extract decryption parameters from JSON data
    selected_algos = json_data["selected_algos"]  # Encryption algorithms used
    all_passphrases = json_data["all_passphrases"]  # Passphrases for decryption
    filename = json_data["filename"]  # Original filename of the PDF
    all_salts = extract_salt(all_passphrases)  # Extract salts from passphrases

    # Decrypt the PDF data using the provided parameters
    output = decrypt_pdf(encrypted_data, nonces_data, hash_data, selected_algos, all_passphrases, all_salts)

    # Return error if decryption fails due to incorrect password or tampered file
    if output is None:
        return jsonify({"error": "Decryption failed. Incorrect password or file tampered."}), 401

    # List of standard fonts available in ReportLab
    standard_fonts = [
        "Times-Roman", "Times-Bold", "Times-Italic", "Times-BoldItalic",
        "Helvetica", "Helvetica-Bold", "Helvetica-Oblique", "Helvetica-BoldOblique",
        "Courier", "Courier-Bold", "Courier-Oblique", "Courier-BoldOblique",
        "Symbol", "ZapfDingbats"
    ]

    # Function to validate hexadecimal color codes
    def is_valid_hex_color(color):
        if isinstance(color, str) and color.startswith('#') and len(color) == 7:
            try:
                int(color[1:], 16)  # Convert the hex code to an integer to validate
                return True
            except ValueError:
                return False
        return False

    # Function to validate integer values within an optional range
    def is_valid_integer(value, min_value=None, max_value=None):
        try:
            int_value = int(value)
            if (min_value is not None and int_value < min_value) or (max_value is not None and int_value > max_value):
                return False
            return True
        except (ValueError, TypeError):
            return False

    # Extract watermark parameters from JSON data or use defaults if not provided
    watermark_text = json_data.get("watermark_text", "Confidential")  # Watermark text
    watermark_color = json_data.get("watermark_color", "#FF0000")  # Watermark color

    if not is_valid_hex_color(watermark_color):
        watermark_color = "#FF0000"  # Default color if invalid

    watermark_row = json_data.get("watermark_row", 3)  # Watermark font size
    if not is_valid_integer(watermark_row, min_value=1):
        watermark_row = 3  # Default size if invalid

    watermark_column = json_data.get("watermark_column", 3)  # Watermark font size
    if not is_valid_integer(watermark_column, min_value=1):
        watermark_column = 3  # Default size if invalid

    watermark_size = json_data.get("watermark_size", 40)  # Watermark font size
    if not is_valid_integer(watermark_size, min_value=1):
        watermark_size = 40  # Default size if invalid

    watermark_angle = json_data.get("watermark_angle", 45)  # Watermark rotation angle
    if not is_valid_integer(watermark_angle, min_value=-360, max_value=360):
        watermark_angle = 45  # Default angle if invalid

    watermark_opacity = json_data.get("watermark_opacity", 50)  # Watermark opacity percentage
    if not is_valid_integer(watermark_opacity, min_value=0, max_value=100):
        watermark_opacity = 50  # Default opacity if invalid

    watermark_font = json_data.get("watermark_font", "Times-Roman")  # Watermark font
    if watermark_font not in standard_fonts:
        watermark_font = "Times-Roman"  # Default font if invalid

    # Add watermark to the decrypted PDF data
    watermark_output = add_watermark_to_pdf(output, watermark_text, watermark_color, watermark_opacity, watermark_font, watermark_size, watermark_angle, watermark_row, watermark_column)

    # Prepare the watermarked PDF for download
    pdf_stream = BytesIO(watermark_output)
    pdf_stream.seek(0)
    return send_file(pdf_stream, mimetype='application/pdf', as_attachment=True, download_name=f'{filename}_decrypted_file.pdf')

if __name__ == '__main__':
    app.run(debug=True, port=5000)
