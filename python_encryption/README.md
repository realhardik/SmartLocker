# Smart-Locker - PDF Encryption and Decryption Web Service

This repository hosts a Flask-based web service designed to provide secure encryption and decryption of PDF documents using a variety of symmetric encryption algorithms. The service supports both individual file uploads and batch encryption/decryption through ZIP archives, ensuring flexibility and ease of use. This tool is ideal for securing sensitive documents by applying encryption and watermarking techniques.

## Features

- **PDF Encryption**: Encrypt PDF documents using a wide array of cryptographic algorithms, including AES, Blowfish, and ChaCha20, ensuring strong protection for sensitive content.
- **Watermarking**: Automatically add a configurable watermark to the encrypted PDFs to indicate the document's confidential nature. Watermarks can be customized in terms of color, opacity, font, and angle.
- **Flexible Input Handling**: Accepts both individual file uploads and ZIP archives containing the necessary encrypted content, offering the user multiple options for input.
- **Hash Validation**: Each encrypted PDF is hashed using SHA-256, providing an integrity check to verify the authenticity and integrity of the document during decryption.
- **Robust Decryption**: Decrypt encrypted PDFs using the correct decryption algorithm and passphrase combination, ensuring access to the original content with security guarantees.

## Endpoints

### `/encrypt` (POST)
Encrypts a PDF file using a set of user-selected encryption algorithms. Optionally, a watermark can be added to the PDF.

#### Request:

- **Files**: Upload the original PDF to be encrypted as `original_pdf`.
- **Form Data**: The form must contain a JSON object with the encryption configuration:
  
  Example JSON payload:
  ```json
  {
    "selected_algos": ["aes128", "aes256"],
    "all_passphrases": ["passphrase1", "passphrase2"],
    "filename": "document_filename"
  }

- **selected_algos**: List of encryption algorithms to be applied (e.g., aes128, blowfish, chacha20poly1305).
- **all_passphrases**: List of passphrases corresponding to the selected algorithms.
- **filename**: The desired name for the output files.
#### Response:
A ZIP file containing the following:

- encrypted.enc: The encrypted PDF file.
- encrypted.nonces.json: Nonces used during the encryption process, encoded in base64.
- encrypted.hash: SHA-256 hash of the encrypted PDF.

The ZIP file will be automatically downloaded as document_filename_encrypted_files.zip.

### `/decrypt` (POST)
Decrypts a previously encrypted PDF file. The service supports both individual files and ZIP archives for decryption.

#### Request:
**Option 1**: Upload a ZIP file (encrypted_files.zip) containing the following files:

- **encrypted.enc**: The encrypted PDF.
- **encrypted.nonces.json**: Nonces used in the encryption process.
- **encrypted.hash**: SHA-256 hash of the encrypted PDF.

**Option 2**: Upload individual files (encrypted.enc, encrypted.nonces.json, and encrypted.hash).

- **Form Data**: A JSON object must be included in the request body containing the decryption parameters:

    Example JSON payload:
    ```json
    {
    "selected_algos": ["aes128", "aes256"],
    "all_passphrases": ["passphrase1", "passphrase2"],
    "filename": "document_filename"
    }
    ```
- **selected_algos**: List of decryption algorithms to use.
- **all_passphrases**: List of passphrases associated with the encryption algorithms.
- **filename**: The desired name for the decrypted output file.

#### Response:
A decrypted PDF file will be returned as an attachment, named as document_filename_decrypted_file.pdf.

If decryption fails due to incorrect passphrases, a hash mismatch, or file tampering, a 401 Unauthorized response will be returned.

### Encryption Process

#### Watermarking:
Before encryption, a watermark with the text "Confidential" is applied to the PDF document. The watermark can be customized using the following attributes:

- **Color**: Hexadecimal color code (e.g., #FF0000 for red).
- **Opacity**: The opacity of the watermark, expressed as a percentage (e.g., 50 for 50% opacity).
- **Font**: The font used for the watermark text (e.g., Times-Roman).
- **Font** Size: The size of the watermark text (e.g., 40).
- **Angle**: The rotation angle of the watermark text (default is 45 degrees).

#### Encryption:
The PDF is encrypted using one or more symmetric encryption algorithms. The following encryption algorithms are supported:

- AES (128, 256): AES is a widely used symmetric encryption algorithm that provides high security and performance.
- Blowfish: A fast block cipher known for its simplicity and effectiveness.
- ChaCha20-Poly1305: A modern and secure encryption scheme used for authenticated encryption with associated data (AEAD).
- Others: Additional algorithms such as Salsa20, RC4, and XChaCha20 are supported.
Hashing:
A SHA-256 hash is calculated for the encrypted PDF to ensure data integrity. During decryption, the hash is validated to verify that the PDF was not altered.


### Dependencies
The service requires the following libraries:

- Flask: Web framework for building the API.
- PyPDF2: For reading and modifying PDF files.
- reportlab: For creating and overlaying watermarks on PDFs.
- cryptography: A library for implementing cryptographic operations (encryption and decryption).
- zipfile: For working with ZIP archives containing the encrypted data.
- pycryptodome: A commonly used cryptographic library providing additional encryption algorithms.

### Usage
- Example cURL Command for Encrypting a PDF:
    ```bash
    curl -X POST -F "original_pdf=@example.pdf" -F "data={\"selected_algos\": [\"aes128\"], \"all_passphrases\": [\"passphrase1\"], \"filename\": \"example_file\"}" http://localhost:5000/encrypt --output encrypted_files.zip
    ```

- Example cURL Command for Decrypting a PDF:
    ```bash
    curl -X POST -F "encrypted_files.zip=@encrypted_files.zip" -F "data={\"selected_algos\": [\"aes12
    ```