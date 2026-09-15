**Nama:** Nathanael Oliver  
**NRP:** 5025241109
**Nama:** Mario Napitupulu  
**NRP:** 5025241085

# Output Praktikum 2 — WebGL Primitive Playground

Output ini mengerjakan Tugas Inti 1–4, Tugas Utama, serta Challenge A–F dari modul Praktikum 2.

## File

*   `index.html` — struktur halaman dan kontrol;
*   `main.js` — inisialisasi WebGL2, shader, buffer, update, input, dan rendering;
*   `style.css` — layout playground dan HUD.

## Fitur yang diimplementasikan

*   WebGL2 context, viewport, clear color, shader compile/link;
*   vertex buffer dan color buffer;
*   vertex shader dan fragment shader GLSL ES 3.00;
*   triangle, rectangle dari dua triangle, line-based shape, dan procedural grid;
*   minimal dua draw mode: `TRIANGLES`, `LINE_STRIP`, dan `POINTS`;
*   vertex color dengan interpolasi otomatis;
*   rendering loop dengan `requestAnimationFrame()`;
*   dynamic position buffer untuk pergerakan primitive;
*   state-based keyboard movement;
*   event-based reset, pause, mode, dan color;
*   mouse pixel ke NDC;
*   tiga moving objects dengan posisi, kecepatan, dan arah berbeda;
*   spawn primitive pada posisi klik;
*   procedural pattern grid;
*   HUD FPS, jumlah primitive, draw mode aktif, dan mouse NDC.

## Parameter control

| Kontrol | Fungsi |
| :--- | :--- |
| Primitive selector | Memilih triangle, rectangle, line, atau points |
| Draw mode | Mengganti `TRIANGLES`, `LINE_STRIP`, atau `POINTS` |
| Speed | Mengubah kecepatan object bergerak |
| Color buttons | Mengubah warna utama object aktif |
| Arrow keys / WASD | Menggerakkan triangle utama secara kontinu dengan state-based input |
| R | Reset seluruh posisi dan object spawn |
| P | Pause/resume rendering animation |
| C | Mengganti warna secara event-based |
| Klik canvas | Spawn triangle baru pada posisi mouse yang sudah dikonversi ke NDC |
| Clear spawned | Menghapus primitive hasil klik |
| Pattern toggle | Menampilkan/menyembunyikan procedural grid |

## Penjelasan teknis

### Pipeline WebGL
Alur program adalah:

    Canvas → WebGL2 Context → Viewport → Vertex Data → GPU Buffer
           → Vertex Shader → Fragment Shader → Attribute → Draw Call

`main.js` membuat shader, melakukan compile dan link program, membuat position/color buffer, menghubungkan attribute `a_position` dan `a_color`, kemudian menjalankan `gl.drawArrays()`.

### Vertex color dan interpolasi
Setiap vertex memiliki warna RGB. Vertex shader meneruskan warna melalui varying `v_color`. Rasterizer melakukan interpolasi warna untuk fragment di antara vertex, sehingga triangle menghasilkan gradient warna tanpa menghitung warna setiap pixel secara manual.

### Multiple primitive dan draw mode
Rectangle direpresentasikan oleh enam vertex atau dua triangle karena GPU memproses triangle sebagai primitive dasar. Line shape memakai `LINE_STRIP`, sedangkan procedural pattern memakai `POINTS`. Selector mengubah draw mode object yang dipilih.

### Dynamic buffer
Pada Praktikum 2 belum digunakan transformation matrix. Posisi object bergerak dengan menambahkan offset ke base vertex, lalu array posisi terbaru di-upload ke GPU menggunakan `gl.bufferData(..., gl.DYNAMIC_DRAW)`.

### Keyboard
`keydown` dan `keyup` menyimpan state tombol. Update posisi dilakukan setiap frame sehingga movement kontinu tidak bergantung pada keyboard repeat. Tombol R, P, dan C memakai event-based action karena hanya perlu terjadi sekali saat ditekan.

### Mouse ke NDC
Koordinat pixel dikonversi menggunakan:

    ndcX = (pixelX / canvasWidth) * 2 - 1
    ndcY = 1 - (pixelY / canvasHeight) * 2

Nilai NDC digunakan sebagai posisi primitive baru ketika canvas diklik.

## Challenge

*   Challenge A: primitive selector;
*   Challenge B: color control merah, hijau, biru, cyan, random;
*   Challenge C: spawn primitive pada klik;
*   Challenge D: tiga moving objects yang memantul pada batas NDC;
*   Challenge E: procedural grid pattern dari perulangan JavaScript;
*   Challenge F: HUD FPS, jumlah primitive, draw mode, dan mouse NDC.
