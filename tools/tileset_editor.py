#!/usr/bin/env python3
"""Tileset Editor — browse a tileset, select tiles, export."""

import tkinter as tk
from tkinter import ttk, filedialog, messagebox
from PIL import Image, ImageTk, ImageDraw
import os, math, sys

DEFAULT_IMAGE = os.path.join(os.path.dirname(__file__),
    '..', 'public', 'assets', 'inspi', '16.png')


class TilesetEditor:
    def __init__(self, root, image_path):
        self.root = root
        self.root.title(f"Tileset Editor — {os.path.basename(image_path)}")

        self.src = Image.open(image_path).convert('RGBA')
        self.src_w, self.src_h = self.src.size

        self.tile_size = 16
        self.zoom = 2
        self.selected = set()          # (row, col)
        self.drag_start = None
        self.dragging = False

        # Strip-based rendering (avoids one giant PhotoImage)
        self.strip_src_h = 256         # source px per strip
        self.strips = {}               # idx -> PhotoImage
        self._preview_tk = None

        self._build_ui()
        self._render()

    # ── UI ──────────────────────────────────────────────────────────

    def _build_ui(self):
        # Toolbar
        tb = ttk.Frame(self.root)
        tb.pack(fill=tk.X, padx=8, pady=4)

        ttk.Label(tb, text="Grid:").pack(side=tk.LEFT)
        self.size_var = tk.StringVar(value="16")
        s = ttk.Combobox(tb, textvariable=self.size_var,
                         values=["8", "16", "32", "64"], width=4, state="readonly")
        s.pack(side=tk.LEFT, padx=(2, 10))
        s.bind("<<ComboboxSelected>>", lambda _: self._on_settings())

        ttk.Label(tb, text="Zoom:").pack(side=tk.LEFT)
        self.zoom_var = tk.StringVar(value="2")
        z = ttk.Combobox(tb, textvariable=self.zoom_var,
                         values=["1", "2", "3", "4"], width=4, state="readonly")
        z.pack(side=tk.LEFT, padx=(2, 10))
        z.bind("<<ComboboxSelected>>", lambda _: self._on_settings())

        ttk.Separator(tb, orient=tk.VERTICAL).pack(side=tk.LEFT, fill=tk.Y, padx=8)
        ttk.Button(tb, text="Export", command=self._export).pack(side=tk.LEFT, padx=4)
        ttk.Button(tb, text="Clear", command=self._clear).pack(side=tk.LEFT, padx=4)

        self.status = tk.StringVar(value="Ready")
        ttk.Label(tb, textvariable=self.status).pack(side=tk.RIGHT)

        # Main paned
        pw = ttk.PanedWindow(self.root, orient=tk.HORIZONTAL)
        pw.pack(fill=tk.BOTH, expand=True, padx=4, pady=4)

        # Left — tileset canvas
        lf = ttk.Frame(pw)
        self.canvas = tk.Canvas(lf, bg='#2a2a2a', highlightthickness=0)
        vs = ttk.Scrollbar(lf, orient=tk.VERTICAL, command=self.canvas.yview)
        hs = ttk.Scrollbar(lf, orient=tk.HORIZONTAL, command=self.canvas.xview)
        self.canvas.configure(
            yscrollcommand=lambda *a: (vs.set(*a), self.root.after_idle(self._load_visible)),
            xscrollcommand=hs.set,
        )
        vs.pack(side=tk.RIGHT, fill=tk.Y)
        hs.pack(side=tk.BOTTOM, fill=tk.X)
        self.canvas.pack(fill=tk.BOTH, expand=True)
        pw.add(lf, weight=3)

        # Right — preview
        rf = ttk.LabelFrame(pw, text="Selection preview")
        self.preview = tk.Canvas(rf, bg='#1a1a1a', highlightthickness=0, width=200)
        ps = ttk.Scrollbar(rf, orient=tk.VERTICAL, command=self.preview.yview)
        self.preview.configure(yscrollcommand=ps.set)
        ps.pack(side=tk.RIGHT, fill=tk.Y)
        self.preview.pack(fill=tk.BOTH, expand=True)
        pw.add(rf, weight=1)

        # Mouse
        self.canvas.bind("<Button-1>", self._press)
        self.canvas.bind("<B1-Motion>", self._motion)
        self.canvas.bind("<ButtonRelease-1>", self._release)
        self.canvas.bind("<Button-2>", self._deselect)
        self.canvas.bind("<Button-3>", self._deselect)

        # Scroll (macOS + Linux)
        self.canvas.bind("<MouseWheel>", self._scroll)
        self.canvas.bind("<Button-4>", lambda _: self.canvas.yview_scroll(-3, "units"))
        self.canvas.bind("<Button-5>", lambda _: self.canvas.yview_scroll(3, "units"))

        self.canvas.bind("<Configure>", lambda _: self.root.after_idle(self._load_visible))

    # ── Rendering ───────────────────────────────────────────────────

    def _render(self):
        z = self.zoom
        dw, dh = self.src_w * z, self.src_h * z
        self.canvas.delete("all")
        self.canvas.configure(scrollregion=(0, 0, dw, dh))
        self.strips.clear()
        self._load_visible()

    def _load_visible(self):
        z = self.zoom
        sh = self.strip_src_h * z  # display height per strip

        try:
            y0 = self.canvas.canvasy(0)
            y1 = self.canvas.canvasy(self.canvas.winfo_height())
        except Exception:
            y0, y1 = 0, 800

        first = max(0, int(y0 // sh))
        last = min(math.ceil(self.src_h / self.strip_src_h) - 1, int(y1 // sh))

        for si in range(first, last + 1):
            if si in self.strips:
                continue
            self._render_strip(si)

    def _render_strip(self, si):
        z = self.zoom
        ts = self.tile_size
        sy0 = si * self.strip_src_h
        sy1 = min(sy0 + self.strip_src_h, self.src_h)
        sw, sh = self.src_w, sy1 - sy0

        # Checkerboard background (shows transparency)
        bg = Image.new('RGBA', (sw, sh))
        draw = ImageDraw.Draw(bg)
        cs = 8
        for cy in range(0, sh, cs):
            for cx in range(0, sw, cs):
                c = '#3a3a3a' if (cx // cs + cy // cs) % 2 == 0 else '#2a2a2a'
                draw.rectangle([cx, cy, cx + cs - 1, cy + cs - 1], fill=c)

        bg = Image.alpha_composite(bg, self.src.crop((0, sy0, sw, sy1)))

        # Grid lines
        draw = ImageDraw.Draw(bg)
        for x in range(0, sw, ts):
            draw.line([(x, 0), (x, sh - 1)], fill=(80, 80, 80, 120))
        for y in range(0, sh, ts):
            draw.line([(0, y), (sw - 1, y)], fill=(80, 80, 80, 120))

        # Scale
        disp = bg.resize((sw * z, sh * z), Image.NEAREST)
        tk_img = ImageTk.PhotoImage(disp)
        self.strips[si] = tk_img
        self.canvas.create_image(0, si * self.strip_src_h * z,
                                 anchor=tk.NW, image=tk_img, tags="strip")

        # Ensure selections render on top
        self.canvas.tag_raise("sel")
        self.canvas.tag_raise("drag")

    # ── Interaction ─────────────────────────────────────────────────

    def _px_to_tile(self, event):
        x = self.canvas.canvasx(event.x)
        y = self.canvas.canvasy(event.y)
        ts = self.tile_size * self.zoom
        c = int(x // ts)
        r = int(y // ts)
        max_c = self.src_w // self.tile_size - 1
        max_r = self.src_h // self.tile_size - 1
        return max(0, min(r, max_r)), max(0, min(c, max_c))

    def _press(self, event):
        self.drag_start = self._px_to_tile(event)
        self.dragging = False

    def _motion(self, event):
        if not self.drag_start:
            return
        self.dragging = True
        cur = self._px_to_tile(event)
        r0, c0 = self.drag_start
        r1, c1 = cur
        z = self.zoom
        ts = self.tile_size * z

        self.canvas.delete("drag")
        self.canvas.create_rectangle(
            min(c0, c1) * ts, min(r0, r1) * ts,
            (max(c0, c1) + 1) * ts, (max(r0, r1) + 1) * ts,
            outline='#ffff00', width=2, dash=(4, 4), tags="drag")

    def _release(self, event):
        if not self.drag_start:
            return
        end = self._px_to_tile(event)
        r0, c0 = self.drag_start
        r1, c1 = end

        if not self.dragging:
            # Toggle single tile
            t = (r0, c0)
            if t in self.selected:
                self.selected.discard(t)
            else:
                self.selected.add(t)
        else:
            # Add rectangle
            for r in range(min(r0, r1), max(r0, r1) + 1):
                for c in range(min(c0, c1), max(c0, c1) + 1):
                    self.selected.add((r, c))

        self.drag_start = None
        self.dragging = False
        self._draw_selection()
        self._update_status()
        self._update_preview()

    def _deselect(self, event):
        self.selected.discard(self._px_to_tile(event))
        self._draw_selection()
        self._update_status()
        self._update_preview()

    def _scroll(self, event):
        d = -1 if event.delta > 0 else 1
        self.canvas.yview_scroll(d * 3, "units")

    # ── Selection drawing ───────────────────────────────────────────

    def _draw_selection(self):
        self.canvas.delete("sel")
        self.canvas.delete("drag")
        z = self.zoom
        ts = self.tile_size * z
        for (r, c) in self.selected:
            self.canvas.create_rectangle(
                c * ts, r * ts, (c + 1) * ts, (r + 1) * ts,
                outline='#00ff00', width=2, tags="sel")

    # ── Settings ────────────────────────────────────────────────────

    def _on_settings(self):
        self.tile_size = int(self.size_var.get())
        self.zoom = int(self.zoom_var.get())
        self.selected.clear()
        self.strips.clear()
        self._render()
        self._update_status()
        self.preview.delete("all")

    def _clear(self):
        self.selected.clear()
        self._draw_selection()
        self._update_status()
        self.preview.delete("all")

    def _update_status(self):
        n = len(self.selected)
        ts = self.tile_size
        self.status.set(f"{n} tile{'s' if n != 1 else ''} ({ts}×{ts})")

    # ── Preview ─────────────────────────────────────────────────────

    def _update_preview(self):
        if not self.selected:
            self.preview.delete("all")
            return

        ts = self.tile_size
        rows = sorted(set(r for r, _ in self.selected))
        cols = sorted(set(c for _, c in self.selected))
        row_i = {r: i for i, r in enumerate(rows)}
        col_i = {c: i for i, c in enumerate(cols)}

        pw, ph = len(cols) * ts, len(rows) * ts
        out = Image.new('RGBA', (pw, ph), (0, 0, 0, 0))

        for (r, c) in self.selected:
            tile = self.src.crop((c * ts, r * ts, (c + 1) * ts, (r + 1) * ts))
            out.paste(tile, (col_i[c] * ts, row_i[r] * ts))

        cw = max(self.preview.winfo_width(), 180)
        scale = max(1, min(6, cw // max(pw, 1)))
        disp = out.resize((pw * scale, ph * scale), Image.NEAREST)

        self._preview_tk = ImageTk.PhotoImage(disp)
        self.preview.delete("all")
        self.preview.create_image(4, 4, anchor=tk.NW, image=self._preview_tk)
        self.preview.configure(scrollregion=(0, 0, pw * scale + 8, ph * scale + 8))

    # ── Export ──────────────────────────────────────────────────────

    def _export(self):
        if not self.selected:
            messagebox.showinfo("Export", "Nothing selected.")
            return

        out = filedialog.askdirectory(title="Export to…")
        if not out:
            return

        ts = self.tile_size
        sorted_sel = sorted(self.selected)

        # Individual tiles
        for i, (r, c) in enumerate(sorted_sel):
            tile = self.src.crop((c * ts, r * ts, (c + 1) * ts, (r + 1) * ts))
            tile.save(os.path.join(out, f"tile_{i:04d}_{r}_{c}.png"))

        # Assembled region (bounding box)
        rs = [r for r, _ in sorted_sel]
        cs = [c for _, c in sorted_sel]
        min_r, max_r = min(rs), max(rs)
        min_c, max_c = min(cs), max(cs)
        rw = (max_c - min_c + 1) * ts
        rh = (max_r - min_r + 1) * ts
        region = self.src.crop((min_c * ts, min_r * ts, min_c * ts + rw, min_r * ts + rh))
        region.save(os.path.join(out, "_selection.png"))

        messagebox.showinfo("Export", f"Exported {len(sorted_sel)} tiles + region to:\n{out}")


if __name__ == '__main__':
    path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_IMAGE
    root = tk.Tk()
    root.geometry("1100x750")
    TilesetEditor(root, path)
    root.mainloop()
