from Crypto.Cipher import ARC4
from Crypto.Util.Padding import pad, unpad

def encrypt(data, key, nonce):
    cipher = ARC4.new(key)
    return cipher.encrypt(data), b''

def decrypt(data, key, nonce):
    cipher = ARC4.new(key)
    return cipher.decrypt(data)
