from Crypto.Cipher import ChaCha20_Poly1305
from Crypto.Random import get_random_bytes

def encrypt(data, key, nonce_length):
    nonce = get_random_bytes(nonce_length)
    cipher = ChaCha20_Poly1305.new(key=key, nonce=nonce)
    ciphertext, tag = cipher.encrypt_and_digest(data)
    return ciphertext + tag, nonce

def decrypt(data, key, nonce):
    ciphertext, tag = data[:-16], data[-16:]
    cipher = ChaCha20_Poly1305.new(key=key, nonce=nonce)
    return cipher.decrypt_and_verify(ciphertext, tag)
