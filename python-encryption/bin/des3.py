from Crypto.Cipher import DES3
from Crypto.Random import get_random_bytes

def encrypt(data, key, nonce_length):
    print("Nonce Lenght",nonce_length)
    nonce = get_random_bytes(nonce_length)
    cipher = DES3.new(key, DES3.MODE_CTR, nonce=nonce)
    ciphertext = cipher.encrypt(data)
    return ciphertext, nonce

def decrypt(data, key, nonce):
    cipher = DES3.new(key, DES3.MODE_CTR, nonce=nonce)
    return cipher.decrypt(data)
