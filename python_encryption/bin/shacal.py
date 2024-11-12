from Crypto.Cipher import SHACAL2
from Crypto.Random import get_random_bytes

def encrypt(data, key, nonce_length):
    nonce = get_random_bytes(nonce_length)
    cipher = SHACAL2.new(key=key)
    ciphertext = cipher.encrypt(data)
    return ciphertext, nonce

def decrypt(data, key, nonce):
    cipher = SHACAL2.new(key=key)
    return cipher.decrypt(data)
