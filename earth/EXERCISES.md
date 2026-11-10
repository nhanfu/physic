# Bài tập: Từ thuyết tương đối rộng đến full source code

Tài liệu này là lộ trình biến các phương trình của thuyết tương đối rộng thành demo
`earth/` đang chạy. Mục tiêu không phải học thuộc công thức, mà là trả lời được:

> Tại sao từ một phương trình trắc địa lại sinh ra được một chương trình có camera,
> animation, trail và HUD?

## Cách học

1. Đọc phần lý thuyết ngắn của từng bài.
2. Tự làm bài tập trong `exercises/orbit-starter.js`.
3. Chạy kiểm tra:

   ```bash
   cd earth
   node exercises/check.js
   ```

4. Khi kẹt, mở đúng dòng trong `orbit.js` hoặc `app.js` được ghi ở mục **Đối chiếu**.
5. Chỉ xem toàn bộ đáp án sau khi đã thử. Đáp án chính là `orbit.js` và `app.js`.

Kiểm tra chính module đã hoàn thiện:

```bash
node exercises/check.js orbit.js
```

## Bản đồ full source code

| Mảng | File | Hàm / khối | Nhiệm vụ |
|---|---|---|---|
| Vật lý | `orbit.js:5-10` | hằng số | Đổi đơn vị, `mu`, `rs`, `e` |
| Vật lý | `orbit.js:12-28` | `build` | Điều kiện đầu, `L`, `E` |
| Vật lý | `orbit.js:35-36` | `acc`, `dt` | Phương trình quỹ đạo và `dt/dphi` |
| Vật lý | `orbit.js:38-63` | vòng lặp RK4 | Sinh bảng `x, y, t` |
| Vật lý | `orbit.js:65-81` | kết quả | Precession, metadata |
| Đồ họa | `app.js:9-12` | cấu hình | `PITCH`, `TURNS`, `HEIGHT`, `CYCLE` |
| Đồ họa | `app.js:42-59` | `fit`, `project` | Camera, phép chiếu 4D → 3D |
| Đồ họa | `app.js:61-85` | `indexAtZ`, `posAtZ` | Nội suy theo thời gian |
| Đồ họa | `app.js:189-199` | `drawStatic` | Grid, trục Sun, helix mờ |
| Đồ họa | `app.js:216-262` | `drawTrail` | Trail quá khứ/tương lai |
| Đồ họa | `app.js:264-282` | `drawLabels` | Nhãn thời gian, Earth, Sun |
| Animation | `app.js:283-331` | `render` | Phase, bead, đường cùng thời |
| Tương tác | `app.js:332-395` | event handlers | Drag, wheel, Space, G, R |
| Giao diện | `index.html:32-44` | HUD | Công thức, legend, controls |

---

# Phần A — Vật lý

## Bài 1 — Hệ đơn vị và các hằng số

### Lý thuyết

Trong demo dùng:

- `AU = 1.495978707e8 km`
- `c = 299792.458 km/s`
- `GM = 1.32712440018e11 km^3/s^2`
- `e = 0.0167086`

Đặt `c = 1` và đo độ dài bằng AU. Khi đó:

```text
mu = GM / (c^2 * AU)
rs = 2 * mu
```

`mu` là nửa bán kính Schwarzschild của Mặt Trời, tính bằng AU. `rs` là bán kính
Schwarzschild, cũng tính bằng AU.

### Bài tập

1. Tính `mu` và `rs`.
2. Giải thích vì sao `mu` không có đơn vị.
3. Tính bán kính Schwarzschild của Mặt Trời ra km. So sánh với bán kính Mặt Trời.
4. Vì sao có thể dùng `a = 1 AU` cho quỹ đạo Trái Đất trong bài toán này?

### Kiểm tra

```text
mu ≈ 9.870628715e-9
rs ≈ 1.974125743e-8
rs * AU ≈ 2.95 km
```

### Đối chiếu

`orbit.js:5-10`.

### Câu hỏi tư duy

Nếu đổi `AU` sang mét mà quên đổi `GM`, kết quả sẽ sai như thế nào? Hãy thử bằng số.

---

## Bài 2 — Từ phương trình trắc địa đến phương trình quỹ đạo

### Lý thuyết

Với metric Schwarzschild, trong mặt phẳng xích đạo:

```text
ds^2 = -(1 - rs/r) dt^2 + (1 - rs/r)^(-1) dr^2 + r^2 dphi^2
```

với `c = 1`. Với hạt có khối lượng, dùng tham số riêng `tau`:

```text
E = (1 - rs/r) dt/dtau
L = r^2 dphi/dtau
```

Từ điều kiện trắc địa timelike:

```text
(dr/dtau)^2 = E^2 - (1 - rs/r)(1 + L^2/r^2)
```

Đổi biến:

```text
u = 1/r
dr/dtau = -L du/dphi
```

ta được:

```text
L^2 (du/dphi)^2 = E^2 - (1 - rs u)(1 + L^2 u^2)
```

Đạo hàm hai vế theo `phi` rồi rút gọn:

```text
d^2u/dphi^2 + u = mu/L^2 + (3/2) rs u^2
```

Đây là phương trình trung tâm của toàn bộ demo. Số hạng `(3/2) rs u^2` là phần
sửa của GR; nếu bỏ nó, ta quay về bài toán Kepler Newton.

### Bài tập

1. Tự làm lại bước đạo hàm, không nhìn đáp án.
2. Viết hàm `orbitAccel(u, mu, L, rs)` trả về `u''`.
3. Kiểm tra dấu của từng số hạng. Vì sao số hạng `-u` phải âm?
4. Với `u = 1`, giá trị `u''` là bao nhiêu?

### Kiểm tra

Tại `u = 1`:

```text
orbitAccel(1, mu, L, rs) = mu/L^2 + 1.5*rs - 1
```

Nếu dấu bị sai, quỹ đạo sẽ không còn tuần hoàn hoặc nổ tung.

### Đối chiếu

`orbit.js:35`.

### Gợi ý

`L^2` là bình phương mô-men động lượng riêng, không phải `L` nhân 2.

---

## Bài 3 — Năng lượng và thời gian tọa độ

### Lý thuyết

Demo bắt đầu tại perihelion (điểm gần Mặt Trời nhất). Tại đó `dr/dtau = 0`, nên:

```text
E = sqrt((1 - rs*u0) * (1 + L^2*u0^2))
```

với:

```text
u0 = 1 / (1 - e)
```

Để vẽ trục thời gian, cần `dt/dphi`:

```text
dt/dtau = E / (1 - rs*u)
dphi/dtau = L*u^2
```

suy ra:

```text
dt/dphi = E / (L*u^2*(1 - rs*u))
```

### Bài tập

1. Viết `timelikeEnergy(u0, L, rs)`.
2. Viết `coordTimeRate(u, E, L, rs)`.
3. Tính `E` và `dt/dphi` tại perihelion.
4. Vì sao `E` gần bằng `1`? Điều đó nói gì về vận tốc quỹ đạo so với `c`?

### Kiểm tra

```text
u0 ≈ 1.016992521
E ≈ 0.999999995
dt/dphi tại perihelion ≈ 9733.13 (AU/c trên radian)
```

`E` gần `1` vì Trái Đất chuyển động rất chậm so với ánh sáng. Đây là lý do các
hiệu ứng GR trên quỹ đạo Trái Đất rất nhỏ.

### Đối chiếu

`orbit.js:24-28` và `orbit.js:36`.

---

## Bài 4 — RK4 cho hệ phương trình bậc nhất

### Lý thuyết

Đặt:

```text
u' = w
w' = orbitAccel(u)
phi' = 1
t' = coordTimeRate(u)
```

Trạng thái:

```js
{ u, w, phi, t, E }
```

Một bước RK4 với bước `h`:

```text
k1 = f(state)
k2 = f(state + h*k1/2)
k3 = f(state + h*k2/2)
k4 = f(state + h*k3)
state += h*(k1 + 2*k2 + 2*k3 + k4)/6
```

### Bài tập

1. Viết `rk4Step(state, h, mu, L, rs)`.
2. Cài đặt đủ bốn thành phần `u, w, phi, t`.
3. Vì sao `phi` có thể tăng tuyến tính `phi += h`?
4. Thử `h = 0.004` và `h = 0.001`. Sai số `tTotal` thay đổi bao nhiêu?

### Kiểm tra

Sau một bước, mọi giá trị phải hữu hạn. Nếu `u` hoặc `w` thành `NaN`, kiểm tra lại
thứ tự cập nhật: RK4 phải dùng giá trị cũ của `state` cho cả bốn `k`.

### Đối chiếu

`orbit.js:46-62`.

### Gợi ý

Có thể viết một hàm `derivs(state)` trả về `{ du, dw, dphi, dt }` rồi dùng lại cho
`k1..k4`. Cách này ít lỗi hơn là viết tay từng dòng.

---

## Bài 5 — Dựng bảng quỹ đạo

### Lý thuyết

Với `turns` vòng:

```text
n = max(64, round(turns * 2*pi / h0))
h = turns * 2*pi / n
```

Bắt đầu tại perihelion:

```text
u = 1/(1-e)
w = 0
phi = 0
t = 0
```

Mỗi bước lưu:

```text
r = 1/u
x = r*cos(phi)
y = r*sin(phi)
```

rồi mới cập nhật trạng thái. Làm vậy để mảng có `n+1` điểm, gồm cả điểm cuối.

### Bài tập

1. Cài đặt `build(opts)` trả về đúng cấu trúc của `orbit.js`.
2. Dùng `Float64Array` cho `x, y, t, u`.
3. Kiểm tra `t` tăng đơn điệu.
4. Kiểm tra điểm đầu và điểm cuối nằm gần perihelion.
5. Đổi `turns = 1` và `turns = 3`, so sánh `n` và `tTotal`.

### Kiểm tra

Với `turns = 1`:

```text
n = 1572
tTotal ≈ 63242.26865
min r ≈ 0.9832914
max r ≈ 1.0167085
```

Với `turns = 3`:

```text
n = 4713
tTotal ≈ 189726.80596
```

Thời gian một vòng phải xấp xỉ 1 năm:

```text
tTotal * AU / c / (365.25*86400) ≈ 1
```

### Đối chiếu

`orbit.js:20-82`.

### Lỗi thường gặp

- Dùng `GM` thay vì `mu`.
- Quên `rs = 2*mu`.
- Lưu điểm sau khi đã cập nhật, làm lệch pha.
- Dùng `r` thay vì `u` trong `orbitAccel`.
- Khởi tạo `w` khác `0`, khiến điểm đầu không còn là perihelion.

---

## Bài 6 — Precession và kiểm chứng vật lý

### Lý thuyết

Mỗi vòng, perihelion dịch thêm:

```text
Delta_phi = 3*pi*rs/(1 - e^2)   (radian/vòng)
```

Đổi sang arcsecond/century:

```text
Delta_arcsec = Delta_phi * 206264.806 * 100
```

Hệ số `100` vì Trái Đất quay khoảng 100 vòng trong một thế kỷ.

### Bài tập

1. Viết `precessionRad(rs, e)`.
2. Tính `Delta_phi` và `Delta_arcsec`.
3. Giải thích vì sao precession không nhìn thấy trên demo.
4. Nếu tăng `rs` lên 1000 lần, điều gì xảy ra với quỹ đạo? Đây có còn là Trái Đất không?

### Kiểm tra

```text
Delta_phi ≈ 1.861089253e-7 rad/vòng
Delta_arcsec ≈ 3.8388 arcsec/century
```

### Đối chiếu

`orbit.js:65` và `orbit.js:80`.

### Câu hỏi tư duy

Vì sao không thể thấy precession bằng cách chạy demo 3 vòng? Muốn thấy cần phóng đại
bao nhiêu lần, và phóng đại như vậy có còn đúng vật lý không?

---

# Phần B — Đồ họa

## Bài 7 — Chiếu 4D xuống 3D

### Lý thuyết

Bảng quỹ đạo có `(x, y, t)`. Demo coi `t` là trục thẳng đứng:

```text
z = t / tTotal * HEIGHT
```

Với camera `yaw`, `pitch`:

```text
xr = -x*sin(yaw) + y*cos(yaw)
yr = -sin(pitch)*(x*cos(yaw) + y*sin(yaw)) + cos(pitch)*(z - zc)
d  =  cos(pitch)*(x*cos(yaw) + y*sin(yaw)) + sin(pitch)*(z - zc)
```

Tọa độ màn hình:

```text
screenX = cx + xr*scale
screenY = cy - yr*scale
```

`d` dùng để sắp xếp bead gần/xa. Đây là phép chiếu trực giao có gợi ý chiều sâu,
không phải phép chiếu phối cảnh đầy đủ.

### Bài tập

1. Cài đặt `project(x, y, z)`.
2. Kiểm tra trường hợp `yaw = 0`, `pitch = 0`: `x` đi vào chiều sâu, `y` nằm ngang,
   `z` thẳng đứng.
3. Vẽ thử ba điểm `(0,0,0)`, `(1,0,0)`, `(0,1,0)` bằng tay.
4. Giải thích vì sao có dấu trừ ở `screenY`.

### Kiểm tra

Ở `yaw = 0`, `pitch = 0`:

```text
project(x, y, z) = { x: cx + y*scale, y: cy - (z-zc)*scale, d: x }
```

### Đối chiếu

`app.js:54-59`.

---

## Bài 8 — Fit camera và lớp tĩnh

### Lý thuyết

Muốn toàn bộ helix nằm trong khung, ước lượng:

```text
extent = HEIGHT*cos(pitch) + 2*1.08*sin(pitch)
fitH = 0.80*height / extent
fitW = 0.68*width / 2.12
base = min(fitH, fitW)
```

`2.12` là đường kính quỹ đạo khoảng `2 AU` cộng lề. `0.80`, `0.68` là hệ số chừa
chỗ cho HUD và nhãn.

Lớp tĩnh chỉ vẽ lại khi camera hoặc grid thay đổi:

- nền,
- grid đáy,
- helix mờ (toàn bộ quỹ đạo),
- trục thời gian của Mặt Trời.

### Bài tập

1. Cài đặt `fit()` và `drawStatic()`.
2. Thử đổi `0.80` thành `0.95`. Chuyện gì xảy ra với nhãn trên cùng?
3. Vì sao không nên vẽ lại grid mỗi frame?
4. Tách canvas tĩnh và canvas động có lợi gì?

### Kiểm tra

Ở `1200x800`, toàn bộ helix, nhãn `1 yr`, `2 yr`, `3 yr`, và đáy grid đều nằm
trong khung. Camera mặc định không cắt mất bead.

### Đối chiếu

`app.js:42-53`, `app.js:189-199`.

---

## Bài 9 — Trail, nội suy và đường cùng thời

### Lý thuyết

Trong demo, `t` tăng theo trục `z`, nên có thể tìm vị trí hiện tại bằng tìm kiếm nhị
phân trên `ZS`:

```text
i = indexAtZ(zNow)
```

Sau đó nội suy tuyến tính giữa `i-1` và `i` để có vị trí mượt:

```text
f = (z - z0)/(z1 - z0)
x = x0 + (x1-x0)*f
y = y0 + (y1-y0)*f
```

Trail:

- Phần đã qua: sáng, cyan.
- Phần chưa tới: mờ, xanh đậm.
- Đường nối Earth và Sun tại cùng `t`: nét đứt vàng nhạt.

### Bài tập

1. Cài đặt `indexAtZ(z)` bằng binary search.
2. Cài đặt `posAtZ(z)`.
3. Vẽ trail quá khứ/tương lai.
4. Vẽ đường cùng thời từ `(0,0,z)` đến `(x,y,z)`.
5. Giải thích vì sao cần nội suy thay vì lấy điểm gần nhất.

### Kiểm tra

Bead Earth luôn nằm đúng trên đầu trail, không bị nhảy giữa hai điểm. Đường cùng thời
luôn nối Sun và Earth ở cùng độ cao `z`.

### Đối chiếu

`app.js:61-85`, `app.js:216-262`, `app.js:311-319`.

---

## Bài 10 — Animation, fade và depth sorting

### Lý thuyết

`phase` chạy trong `[0, 1)`, một vòng demo là 3 năm:

```text
zNow = phase * HEIGHT
phase += dt / CYCLE
```

Với `CYCLE = 27` giây, một năm Trái Đất trên demo mất 9 giây.

Gần `phase = 0` hoặc `phase = 1`, bead và nhãn được fade để tránh nhảy khi loop.
Bead gần camera hơn (`d` nhỏ hơn) được vẽ sau.

### Bài tập

1. Viết vòng `render(now)`.
2. Cài đặt pause bằng Space.
3. Cài đặt fade ở hai đầu cycle.
4. Sắp xếp thứ tự vẽ Sun/Earth bead theo `d`.
5. Đổi `CYCLE` thành `54` và quan sát.

### Kiểm tra

- 3 vòng trong 27 giây.
- Space dừng và chạy lại đúng chỗ.
- Không có bead nào bị vẽ đè sai thứ tự.
- Khi loop, không thấy nhảy đột ngột.

### Đối chiếu

`app.js:283-331`.

---

## Bài 11 — Tương tác và HUD

### Lý thuyết

Các tương tác tối thiểu:

- Kéo chuột: đổi `yaw`, `pitch`.
- Lăn chuột: đổi `zoom`, kẹp trong `[0.45, 4]`.
- Space: pause.
- `G`: bật/tắt grid.
- `R`: reset camera và phase.
- Resize: cập nhật DPR và gọi `fit()`.

HUD cần trả lời ba câu:

1. Đây là hình gì?
2. Trục tung là gì?
3. Đường nào là geodesic, đường nào là lực?

### Bài tập

1. Gắn các event handler.
2. Cài đặt `resize()` có xử lý `devicePixelRatio`.
3. Viết HUD trong `index.html`.
4. Kiểm tra trên màn hình nhỏ: HUD có che mất helix không?

### Kiểm tra

Các phím và chuột hoạt động; sau `R`, camera trở về mặc định; HUD không đè lên
phần chính của helix ở `1200x800`.

### Đối chiếu

`app.js:332-395`, `index.html:32-44`.

---

# Phần C — Kiểm thử và mở rộng

## Bài 12 — Chạy full pipeline

### Bài tập

1. Hoàn thiện `exercises/orbit-starter.js`.
2. Chạy `node exercises/check.js` cho đến khi tất cả kiểm tra đạt.
3. Chạy `node exercises/check.js orbit.js` để xác nhận module tham chiếu cũng đạt.
4. Mở `index.html` bằng trình duyệt.
5. Kiểm tra: pause, grid, reset, drag, wheel.
6. Chụp màn hình ở phase mặc định; kiểm tra không có nhãn nào bị cắt.

### Tiêu chí hoàn thành

- Không có `NaN`.
- `t` tăng đơn điệu.
- Đúng 3 vòng.
- Precession xấp xỉ `3.8388 arcsec/century`.
- Demo chạy được bằng `file://`, không cần server.
- Không sửa demo triple pendulum ở thư mục gốc.

---

## Bài 13 — So sánh Newton và GR

### Bài tập

1. Viết một bảng quỹ đạo Newton bằng cùng bộ đơn vị.
2. Vẽ chồng lên quỹ đạo GR bằng nét đứt.
3. Đo sai khác vị trí theo thời gian.
4. Giải thích vì sao hai đường gần như trùng nhau.
5. Nếu muốn thấy khác biệt, phải phóng đại cái gì? Việc phóng đại có làm hỏng
   ý nghĩa vật lý không?

### Câu hỏi tư duy

Trong không-thời gian Newton–Galileo, đường của Trái Đất có phải geodesic không?
Trong Newton–Cartan thì sao? Câu trả lời khác nhau ở chỗ nào?

---

## Bài 14 — Mở rộng

Chọn một hướng:

1. **Proper time:** thêm `dtau/dphi` và hiển thị thời gian riêng của Trái Đất.
2. **Light geodesic:** dùng lại ý tưởng từ `../blackhole/geodesic.js` để vẽ tia sáng.
3. **Camera nâng cao:** thêm phép chiếu phối cảnh thật, không chỉ orthographic.
4. **Xuất dữ liệu:** xuất bảng `x, y, t` ra CSV để phân tích bằng Python.
5. **Test vật lý:** kiểm tra `E` và `L` được bảo toàn dọc quỹ đạo.
6. **Newton–Cartan:** thêm ghi chú/toggle để so sánh “lực” và “hình học”.

---

## Checklist đọc full source code

- [ ] `orbit.js:5-10` — hiểu từng hằng số.
- [ ] `orbit.js:20-28` — `L`, `E`, điều kiện perihelion.
- [ ] `orbit.js:35-36` — hai phương trình cốt lõi.
- [ ] `orbit.js:46-62` — RK4 từng bước.
- [ ] `orbit.js:65-81` — precession và dữ liệu trả về.
- [ ] `app.js:42-59` — fit và project.
- [ ] `app.js:61-85` — tìm và nội suy theo `z`.
- [ ] `app.js:189-199` — lớp tĩnh.
- [ ] `app.js:216-262` — trail.
- [ ] `app.js:283-331` — render loop.
- [ ] `app.js:332-395` — sự kiện.
- [ ] `index.html` — HUD và thứ tự load script.

Khi đã đi hết checklist này, bạn có thể đọc toàn bộ `orbit.js` + `app.js` như đọc
một bài báo: mỗi dòng đều có lý do vật lý hoặc lý do đồ họa.
