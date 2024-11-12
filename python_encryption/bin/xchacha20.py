from Crypto.Cipher import ChaCha20
from Crypto.Random import get_random_bytes

def encrypt(data, key, nonce_length):
    nonce = get_random_bytes(nonce_length)
    cipher = ChaCha20.new(key=key, nonce=nonce)
    ciphertext = cipher.encrypt(data)
    return ciphertext, nonce

def decrypt(data, key, nonce):
    cipher = ChaCha20.new(key=key, nonce=nonce)
    return cipher.decrypt(data)
