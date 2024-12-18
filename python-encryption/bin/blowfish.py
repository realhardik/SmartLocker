from Crypto.Cipher import Blowfish
from Crypto.Random import get_random_bytes


def encrypt(data, key, nonce_length):
    nonce = get_random_bytes(nonce_length)
    cipher = Blowfish.new(key, Blowfish.MODE_CTR, nonce=nonce)
    ciphertext = cipher.encrypt(data)
    return ciphertext, nonce

def decrypt(data, key, nonce):
    cipher = Blowfish.new(key, Blowfish.MODE_CTR, nonce=nonce)
    return cipher.decrypt(data)


