import struct, zlib, os

def png_chunk(tag, data):
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data))

def write_png(path, size, bg, fg):
    w = h = size
    rows = bytearray()
    cx, cy, r = w / 2, h / 2, w * 0.30
    for y in range(h):
        rows.append(0)
        for x in range(w):
            d = ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2) ** 0.5
            rows.extend(fg if d <= r else bg)
    raw = zlib.compress(bytes(rows), 9)
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)
    with open(path, "wb") as f:
        f.write(sig)
        f.write(png_chunk(b"IHDR", ihdr))
        f.write(png_chunk(b"IDAT", raw))
        f.write(png_chunk(b"IEND", b""))

os.makedirs("icons", exist_ok=True)
bg = bytes((15, 23, 42))   # slate-900
fg = bytes((96, 165, 250)) # blue-400
for size in (192, 512):
    write_png(f"icons/icon-{size}.png", size, bg, fg)
print("icons written")
