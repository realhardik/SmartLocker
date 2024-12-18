from Crypto.Cipher import AES
from Crypto.Random import get_random_bytes

def encrypt(data, key, nonce_length):
    nonce = get_random_bytes(nonce_length)
    cipher = AES.new(key, AES.MODE_GCM, nonce=nonce)
    ciphertext, tag = cipher.encrypt_and_digest(data)
    return ciphertext + tag, nonce

def decrypt(data, key, nonce):
    ciphertext, tag = data[:-16], data[-16:]
    cipher = AES.new(key, AES.MODE_GCM, nonce=nonce)
    return cipher.decrypt_and_verify(ciphertext, tag)
