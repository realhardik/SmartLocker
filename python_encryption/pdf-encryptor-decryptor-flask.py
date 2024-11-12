import json
import base64
import hashlib
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from io import BytesIO
import zipfile
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
import PyPDF2
from bin.keygen import gen_key  # Custom module to generate encryption keys
from bin import *  # Import encryption and decryption functions

app = Flask(__name__)
CORS(app)
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
def add_watermark_to_pdf(pdf_data, watermark_text, color_hex, opacity, font, size, angle=45):
    packet = BytesIO()
    can = canvas.Canvas(packet, pagesize=letter)
    color = colors.HexColor(color_hex)
    can.setFillColor(color, opacity / 100.0)
    
    width, height = letter
    width, height = int(width), int(height)
    can.setFont(font, size)
    
    # Draw watermark across the page
    for x in range(0, width, 200):
        for y in range(0, height, 200):
            can.saveState()
            can.translate(x + 100, y + 100)
            can.rotate(angle)
            can.drawString(-100, -20, watermark_text)
            can.restoreState()
    
    can.save()
    packet.seek(0)

    # Merge watermark with the existing PDF pages
    existing_pdf = PyPDF2.PdfReader(BytesIO(pdf_data))
    output = PyPDF2.PdfWriter()
    watermark_pdf = PyPDF2.PdfReader(packet)
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
    pdf_data = add_watermark_to_pdf(pdf_data, "Confidential", "#FF0000", 50, "Times-Roman", 40)
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
    print("File successfully read")
    json_data = request.form.get('data')
    if not json_data:
        return jsonify({"error": "No JSON data provided"}), 400
    try:
        json_data = json.loads(json_data)
    except json.JSONDecodeError:
        return jsonify({"error": "Invalid JSON data"}), 400
    print("JSON there")
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
                encrypted_data = zip_ref.read('encrypted.enc')
                nonces_data = json.loads(zip_ref.read('encrypted.nonces.json').decode('utf-8'))
                hash_data = zip_ref.read('encrypted.hash').decode('utf-8').strip('"').strip()
        except (KeyError, zipfile.BadZipFile, json.JSONDecodeError):
            return jsonify({"error": "Invalid ZIP file or missing required files"}), 400

    # Option 2: Check if individual files were uploaded
    elif all(file_key in request.files for file_key in ['encrypted.enc', 'encrypted.nonces.json', 'encrypted.hash']):
        # Read individual uploaded files
        encrypted_data = request.files['encrypted.enc'].read()
        try:
            nonces_data = json.loads(request.files['encrypted.nonces.json'].read().decode('utf-8'))
        except json.JSONDecodeError:
            return jsonify({"error": "Invalid JSON format in nonces file"}), 400
        
        hash_data = request.files['encrypted.hash'].read().decode('utf-8').strip('"').strip()
    
    else:
        # Return error if neither the ZIP file nor the individual files are provided
        return jsonify({"error": "Please upload either 'encrypted_files.zip' or all required files (encrypted.enc, encrypted.nonces.json, encrypted.hash)"}), 400

    # Parse JSON data containing decryption parameters
    json_data = request.form.get('data')
    if not json_data:
        return jsonify({"error": "No JSON data provided"}), 400
    try:
        json_data = json.loads(json_data)
    except json.JSONDecodeError:
        return jsonify({"error": "Invalid JSON data"}), 400

    # Extract decryption parameters
    selected_algos = json_data["selected_algos"]
    all_passphrases = json_data["all_passphrases"]
    filename = json_data["filename"]
    all_salts = extract_salt(all_passphrases)

    # Decrypt the PDF data
    output = decrypt_pdf(encrypted_data, nonces_data, hash_data, selected_algos, all_passphrases, all_salts)

    # Return the decrypted PDF data or an error message if decryption failed
    if output is None:
        return jsonify({"error": "Decryption failed. Incorrect password or file tampered."}), 401
    else:
        pdf_stream = BytesIO(output)
        pdf_stream.seek(0)
        return send_file(pdf_stream, mimetype='application/pdf', as_attachment=True, download_name=f'{filename}_decrypted_file.pdf')

if __name__ == '__main__':
    app.run(debug=True, port=5000)
