"""Re-encodes the WebP art in a built dist/ lossy (default quality 80) to shrink the Windows package (the originals in
public/assets stay untouched). Keeps a file only when smaller; keeps alpha. Usage: python scripts/recompress-dist.py <dist> [quality]"""
import os, sys, io
from multiprocessing import Pool
from PIL import Image

Q = int(sys.argv[2]) if len(sys.argv) > 2 else 80

def one(path):
    try:
        old = os.path.getsize(path)
        im = Image.open(path)
        if getattr(im, 'n_frames', 1) > 1:
            return old, old
        b = io.BytesIO(); im.save(b, 'WEBP', quality=Q, alpha_quality=100, method=4)
        if b.tell() < old:
            with open(path, 'wb') as f: f.write(b.getvalue())
            return old, b.tell()
        return old, old
    except Exception:
        return 0, 0

if __name__ == '__main__':
    root = sys.argv[1]
    files = [os.path.join(d, f) for d, _, fs in os.walk(root) for f in fs if f.endswith('.webp')]
    print(len(files), 'files, quality', Q, flush=True)
    a = b = 0
    with Pool(max(1, os.cpu_count() - 2)) as p:
        for i, (x, y) in enumerate(p.imap_unordered(one, files, chunksize=64)):
            a += x; b += y
            if i % 5000 == 0: print(i, round(a / 1e6), '->', round(b / 1e6), 'MB', flush=True)
    print('done', round(a / 1e6), '->', round(b / 1e6), 'MB')
