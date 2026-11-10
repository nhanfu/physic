# Đường trắc địa của Trái Đất & khóa học "GR thành source code"

Không cần build, không cần cài gì — mở file HTML trong trình duyệt là chạy.

```
geodesic/
├── simulation/          Mô phỏng quỹ đạo Trái Đất = đường trắc địa Schwarzschild
│   ├── index.html
│   ├── physics.js       Toàn bộ vật lý (metric, Christoffel, RK4, E/L, tiên động) — chạy được cả trong Node
│   └── main.js          Chỉ phần vẽ & giao diện
├── exercises/           17 bài tập lập trình có test tự động + 1 sân chơi
│   ├── index.html
│   ├── exercises.js     Nội dung: lý thuyết, code khởi đầu, lời giải, test, minh họa
│   ├── runner.js        Biên dịch code người học, dựng `lib`, chạy test
│   └── app.js           Editor, điều hướng, gợi ý, bộ vẽ
└── tools/verify.js      Kiểm chứng mọi lời giải qua test + mô phỏng khớp lý thuyết
```

## Chạy

- Mô phỏng: mở `simulation/index.html`
- Bài tập: mở `exercises/index.html` (cần mạng lần đầu để tải KaTeX & CodeMirror từ cdnjs; nếu offline vẫn chạy được với textarea thường)
- Kiểm chứng: `node tools/verify.js`

Nếu trình duyệt chặn `file://`, chạy `python3 -m http.server` trong thư mục `geodesic/` rồi mở `http://localhost:8000/`.

## Mô phỏng

Trái Đất được tích phân trực tiếp theo phương trình trắc địa `d²xᵘ/dτ² = −Γᵘ_αβ uᵅ uᵝ` trong metric Schwarzschild,
song song với một quỹ đạo Newton để so sánh.

- **Quỹ đạo**: GR (xanh) vs Newton (xám đứt nét), các lần qua cận nhật (hồng). Cuộn chuột để zoom.
- **Worldline (x, y, t)**: đường trắc địa thật sự trong không-thời gian — một đường xoắn ốc. Kéo để xoay.
- **Không gian cong**: sơ đồ nhúng Flamm của lát cắt t = const.
- **Thế hiệu dụng** và **cận nhật tích lũy** (đo được ngay cả với khối lượng thật).
- **Số liệu**: tiên động đo được vs `6πM/(a(1−e²))`, đồng hồ Trái Đất chậm 0.467 s/năm, E, L, ràng buộc `g(u,u) = −1`, Christoffel.

Với giá trị thật, tiên động chỉ 3.84″/thế kỷ: mô phỏng đo được giá trị này chính xác tới ~0.1% nhưng mắt không thấy được.
Kéo thanh "Khối lượng Mặt Trời" (hoặc nút *Phóng đại* / *Trường mạnh*) để thấy quỹ đạo hoa hồng. Ở trường mạnh, giá trị đo
lệch khỏi công thức bậc một — đó là hiệu ứng GR bậc cao, không phải lỗi số.

## Lộ trình bài tập

| Chương | Bài | Bạn viết |
|---|---|---|
| 1. Công cụ số | RK4 · Quỹ đạo Newton | `rk4Step`, `integrate`, `keplerRHS` |
| 2. Metric & tensor | Minkowski · 4-vận tốc · Độ dài đường cong | `metricDot`, `normalizeTimelike`, `curveLength` |
| 3. Christoffel & trắc địa | Christoffel số · Phương trình trắc địa · Đại vòng tròn | `christoffel`, `geodesicRHS`, `integrateGeodesic` |
| 4. Schwarzschild | Metric & đơn vị · Christoffel giải tích · Trắc địa xích đạo | `schwarzschildMetric`, `schwarzschildChristoffel`, `schwarzschildRHS` |
| 5. Kiểm chứng | V_eff & ISCO · Điều kiện đầu · Sao Thủy 43″ · GPS 38.6 µs · Eddington 1.75″ | `orbitInit`, `measurePrecession`, `photonDeflection`… |
| 6. Tổng hợp | Bộ mô phỏng hoàn chỉnh · Thử thách mở rộng | `createSimulator` |

Mỗi bài có `lib` chứa **lời giải tham khảo của mọi bài trước**, nên bài nào cũng làm độc lập được, nhưng làm theo thứ tự
thì bạn sẽ tự xây lại toàn bộ `simulation/physics.js` từ con số 0. Code và tiến độ được lưu trong `localStorage`.
