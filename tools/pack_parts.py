"""Pack the can crusher STL parts into one small JS file for the web page.

Reads every *.stl in the STL folder (inches, CAD axes, assembly position),
welds vertices, builds crease-aware normals (sharp CAD edges stay sharp),
finds feature edges for the CAD outline lines, quantizes positions to
uint16 and normals to int8, and writes models/can-crusher-parts.js as
window.CAN_CRUSHER_PARTS = { parts: [...], data: '<base64>' }.

Axes: three.js x = CAD X, y = CAD Z (up), z = -CAD Y.
Usage: python pack_parts.py <stl_dir> <out.js>
"""
import sys, os, glob, json, struct, base64
import numpy as np

CREASE_DEG = 32.0     # faces meeting sharper than this get split normals
EDGE_DEG = 32.0       # and an outline edge

def load_stl(fn):
    data = open(fn, 'rb').read()
    n = struct.unpack('<I', data[80:84])[0]
    arr = np.frombuffer(data[84:84 + n * 50], dtype=np.dtype([('n', '<3f4'), ('v', '<9f4'), ('a', '<u2')]))
    return arr['v'].reshape(-1, 3, 3).astype(np.float64)

def to_three(t):
    out = np.empty_like(t)
    out[..., 0] = t[..., 0]
    out[..., 1] = t[..., 2]
    out[..., 2] = -t[..., 1]
    return out

def pack(tris):
    # weld
    flat = tris.reshape(-1, 3)
    key = np.round(flat / 1e-4).astype(np.int64)
    _, inv, = np.unique(key, axis=0, return_inverse=True)[0:2]
    uniq_idx = np.zeros(inv.max() + 1, dtype=np.int64)
    uniq_idx[inv] = np.arange(len(inv))
    P = flat[uniq_idx]
    F = inv.reshape(-1, 3)
    # drop degenerate faces
    e1 = P[F[:, 1]] - P[F[:, 0]]; e2 = P[F[:, 2]] - P[F[:, 0]]
    fn = np.cross(e1, e2); area = np.linalg.norm(fn, axis=1)
    keep = (area > 1e-10) & (F[:, 0] != F[:, 1]) & (F[:, 1] != F[:, 2]) & (F[:, 0] != F[:, 2])
    F = F[keep]; fn = fn[keep] / area[keep, None]; area = area[keep]
    # vertex -> faces
    vf = [[] for _ in range(len(P))]
    for fi, f in enumerate(F):
        for v in f: vf[v].append(fi)
    cosc = np.cos(np.radians(CREASE_DEG))
    out_pos, out_nrm, out_idx = [], [], []
    vmap = {}
    for fi, f in enumerate(F):
        tri = []
        for v in f:
            nb = vf[v]
            m = np.array([fn[j] @ fn[fi] >= cosc for j in nb])
            nsum = (fn[nb][m] * area[nb][m, None]).sum(0)
            nsum /= np.linalg.norm(nsum) + 1e-12
            q = (v, tuple(np.round(nsum * 127).astype(int)))
            if q not in vmap:
                vmap[q] = len(out_pos); out_pos.append(P[v]); out_nrm.append(nsum)
            tri.append(vmap[q])
        out_idx.append(tri)
    # feature edges on the welded mesh
    edges = {}
    for fi, f in enumerate(F):
        for i in range(3):
            a, b = int(f[i]), int(f[(i + 1) % 3])
            k = (min(a, b), max(a, b))
            edges.setdefault(k, []).append(fi)
    cose = np.cos(np.radians(EDGE_DEG))
    feat = [k for k, fs in edges.items() if len(fs) != 2 or fn[fs[0]] @ fn[fs[1]] < cose]
    # edge endpoints reference output vertices: pick any output vertex at that position
    first_out = {}
    for (v, _), oi in vmap.items():
        first_out.setdefault(v, oi)
    eidx = [(first_out[a], first_out[b]) for a, b in feat]
    return np.array(out_pos), np.array(out_nrm), np.array(out_idx, dtype=np.int64), np.array(eidx, dtype=np.int64), float(np.sum(np.einsum('ij,ij->i', P[F[:, 0]], np.cross(P[F[:, 1]], P[F[:, 2]]))) / 6)

def main(stl_dir, out_js):
    parts, blob = [], bytearray()
    for fn in sorted(glob.glob(os.path.join(stl_dir, '*.stl'))):
        name = os.path.basename(fn)[:-4]
        pid = name.replace('2x ', '').replace(' ', '-')
        tris = to_three(load_stl(fn))
        pos, nrm, idx, eidx, vol = pack(tris)
        mn = pos.min(0); mx = pos.max(0); span = np.maximum(mx - mn, 1e-6)
        q = np.round((pos - mn) / span * 65535).astype('<u2')
        nq = np.clip(np.round(nrm * 127), -127, 127).astype('i1')
        assert len(pos) < 65535
        meta = {'id': pid, 'file': os.path.basename(fn), 'nv': int(len(pos)), 'ni': int(idx.size), 'ne': int(eidx.size),
                'min': [round(float(x), 6) for x in mn], 'span': [round(float(x), 6) for x in span],
                'volume_in3': round(abs(vol), 3), 'offset': len(blob)}
        blob += q.tobytes()
        blob += nq.tobytes()
        if len(blob) % 2: blob += b'\0'
        blob += idx.astype('<u2').tobytes()
        blob += eidx.astype('<u2').tobytes()
        parts.append(meta)
        print(f"{pid:22s} v={len(pos):5d} tris={len(idx):5d} edges={len(eidx):5d} vol={abs(vol):.3f} in3")
    js = ('/* Can crusher parts: geometry of the ten 3D-printed parts, built from the team STL files\n'
          '   by tools/pack_parts.py. Inches. Axes: x = CAD X, y = CAD Z (up), z = -CAD Y.\n'
          '   Layout per part at "offset": uint16 xyz positions (scaled to min/span), int8 xyz normals,\n'
          '   uint16 triangle indices, uint16 outline-edge index pairs. Do not edit by hand. */\n'
          'window.CAN_CRUSHER_PARTS = ' + json.dumps({'parts': parts}, separators=(',', ':'))[:-1] +
          ',"data":"' + base64.b64encode(bytes(blob)).decode() + '"};\n')
    open(out_js, 'w').write(js)
    print('wrote', out_js, len(js), 'bytes')

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
