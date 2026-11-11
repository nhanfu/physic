# Kế hoạch: khử giao cắt và tập tour không giao cắt

Trạng thái: **bản nháp, chưa code**. Cần xác nhận các mục "Quyết định cần chốt" trước khi bắt đầu.

## 1. Mục tiêu

1. Viết hàm `uncross(D, order)`: nhận một tour, trả về tour không cặp cạnh nào giao nhau và độ dài không tăng.
2. Sinh tập tour không giao cắt từ nhiều điểm khởi đầu khác nhau.
3. Đo xem tập này có chứa tour gần tối ưu không, và tour tốt nhất trong tập so với Held-Karp ra sao.
4. Thử lai ghép hai tour không giao cắt để xem có tạo ra tour tốt hơn không.

Không nhắm đến thuật toán đa thức chính xác: TSP là NP-khó, nên mọi hướng ở đây là heuristic có đo đạc.

## 2. Định nghĩa

- **Giao cắt:** hai cạnh không kề nhau `(a,b)` và `(c,d)` của tour có đoạn thẳng cắt nhau. Dùng test định hướng (orientation test) với số học thực; cạnh chung đầu mút không tính là giao cắt.
- **Tour không giao cắt:** không có cặp cạnh không kề nhau nào giao cắt.
- **Phép 2-opt:** thay `(a,b),(c,d)` bằng `(a,c),(b,d)` bằng cách đảo đoạn `b…c`.

## 3. Các bước

### Bước A: `segmentsCross(p1, p2, p3, p4)` và `findCrossing(P, order)`
- Hàm O(1) cho test giao cắt.
- `findCrossing` trả về cặp chỉ số `(i, j)` đầu tiên giao nhau, hoặc `null`. O(m²).
- Test: tam giác và đường thẳng đơn giản; các trường hợp suy biến (điểm trùng, ba điểm thẳng hàng) phải được xử lý và ghi rõ trong test.

### Bước B: `uncross(D, order)`
- Lặp: tìm cặp giao nhau, đảo đoạn, lặp lại đến khi không còn.
- Mỗi bước giảm độ dài chặt (bất đẳng thức tam giác), nên kết thúc. Đặt giới hạn số bước để phòng lỗi làm tròn số thực.
- Test: đầu ra không giao cắt; độ dài đầu ra ≤ đầu vào; là hoán vị hợp lệ (dùng `isPermutation` có sẵn).

### Bước C: sinh tập tour không giao cắt
Ba nguồn, so sánh với nhau:
1. Sắp góc quanh điểm tâm (luôn không giao cắt).
2. `uncross` từ tour ngẫu nhiên (hạt giống cố định).
3. `uncross` từ tour `farthestInsertionTour`.

Với mỗi nguồn: lấy N tour (ví dụ 200), loại trùng lặp, ghi độ dài.

### Bước D: thực nghiệm (n ≤ 12, để có Held-Karp)
- Dùng các case có sẵn trong `cases.js` và sinh thêm tập ngẫu nhiên.
- Đo: tỉ lệ `min(tập) / tối ưu`, số tour tối ưu xuất hiện trong tập, thời gian sinh tập.
- Dùng `twoOptOptimal` có sẵn trong `core.js` để so sánh.

### Bước E (tùy chọn, chỉ làm nếu D cho kết quả đáng chú ý): lai ghép
- Với hai tour không giao cắt, thử cắt mỗi tour thành hai đoạn tại cùng tập điểm và ghép chéo, rồi `uncross` kết quả.
- Đo xem tour con có tốt hơn cha mẹ không.

## 4. Vị trí file

- Module mới: `tsp-compare/uncross.js`, không DOM, cùng phong cách với `core.js` (UMD hoặc `global`, kiểm tra cách `core.js` export).
- Test: `tsp-compare/test/uncross.test.js`, cùng khung `test(name, fn)` của `core.test.js`.
- Script thực nghiệm: đặt trong thư mục scratchpad, không commit, trừ khi bạn muốn giữ lại.
- Không sửa `app.js` và `index.html` trong bước này.

## 5. Tiêu chí hoàn thành

- Test `uncross` pass, bao gồm trường hợp suy biến.
- Có bảng số liệu từ Bước D cho ít nhất 3 nhóm điểm: ngẫu nhiên đều, cụm, và điểm gần vị trí lồi.
- Kết luận rõ ràng: tập không giao cắt có đáng dùng làm không gian tìm kiếm hay không.

## 6. Rủi ro

- **Sai số làm tròn** khi test giao cắt với điểm gần nhau: dùng ngưỡng epsilon nhỏ và ghi lại trong code.
- **Số bước `uncross` lớn** với n lớn: đo, không giả định.
- **Kết quả thực nghiệm dễ bị hiểu nhầm** nếu chỉ dùng một bộ điểm: phải có nhiều nhóm như ở Tiêu chí hoàn thành.

## Quyết định cần chốt

1. Có làm Bước E (lai ghép) ngay, hay chỉ làm A–D trước?
2. Số tour mẫu trong Bước C: 200 có đủ không, hay cần nhiều hơn?
3. Module mới nằm trong `tsp-compare/`, hay đặt chỗ khác?
4. Có commit kế hoạch này không? Hiện nó chưa được commit.

## 7. Hướng B: đường đi theo địa hình (đồi và vành đai)

Ý tưởng: không dùng hàm năng lượng. Mỗi điểm là một ngọn đồi có độ cao `h`, và đường đi là chu trình gồm các đoạn đi xuống xen kẽ với các đoạn nhảy lên.

**Định nghĩa:**
- Độ cao: `h(x) = max over v thuộc vành đai của |x − v|`, với vành đai là tour không giao cắt đã chọn trước (vẫn cần chốt, xem câu hỏi bên dưới).
- Vành đai con: tập con các ngọn đồi được nhóm lại (cách nhóm cần chốt).

**Thuật toán (bản đề xuất):**
1. Chưa thăm điểm nào. Bắt đầu từ ngọn đồi cao nhất chưa thăm.
2. Đi xuống: từ điểm hiện tại, chuyển sang điểm chưa thăm, thấp hơn, gần nhất. Lặp cho đến khi không còn điểm thấp hơn nào chưa thăm trong vành đai con hiện tại.
3. Nhảy lên: chọn ngọn đồi chưa thăm khác để bắt đầu một đoạn đi xuống mới. Lựa chọn nhảy là cao nhất hay gần nhất, cần chốt.
4. Lặp 2–3 cho đến khi thăm hết mọi điểm.
5. Đóng chu trình bằng cạnh từ điểm cuối về điểm đầu.
6. Phá hòa khi cùng độ cao: dùng chỉ số phụ (ví dụ góc quanh tâm), hoặc chọn ngẫu nhiên với hạt giống cố định.

**Kiểm tra:**
- Đầu ra là hoán vị hợp lệ, mỗi điểm đúng một lần.
- Đo tỉ lệ `độ dài / Held-Karp` trên n ≤ 12, với nhiều kiểu điểm.
- So sánh với nearest neighbor thông thường và với farthest insertion trong `core.js`.
- Đo số lần đường đi giao cắt chính nó. Nếu có, áp dụng `uncross` sau đó và đo lại.

**Câu hỏi cần chốt:**
1. Vành đai là tour cố định chọn trước, hay được sinh từ điểm (ví dụ bằng `uncross`)?
2. Vành đai con được xác định thế nào: theo ngưỡng khoảng cách, theo liên thông, hay theo vành đai gốc?
3. Lúc nhảy lên, chọn ngọn đồi cao nhất hay gần nhất trong số chưa thăm?

**Đã chốt:** (1) vành đai = bao lồi rồi `uncross`; (2) vành đai con = thành phần liên thông với ngưỡng `1.5 × trung vị khoảng cách láng giềng gần nhất`; (3) nhảy đến điểm chưa thăm gần nhất.

**Kết quả thử nghiệm (75 case, n ≤ 12, so với Held-Karp):** script tại `/tmp/claude-1000/-home-nhanjs-projects-physic/061ae57e-9a83-4a77-b243-cd165c2c5c75/scratchpad/descent.js`.

| Thuật toán | Trung bình % trên tối ưu | Trúng tối ưu |
|---|---|---|
| Địa hình (descent) | 14.46 | 10/75 |
| Địa hình + uncross | 7.14 | — |
| NN, tốt nhất trong mọi điểm bắt đầu | 1.71 | 43/75 |
| Farthest insertion | 0.45 | — |

- 49/75 tour địa hình (trước uncross) vẫn có giao cắt.

**Biến thể B2 (đã sửa theo ý người dùng): đi vòng vành đai từ ngoài vào trong.** Các vành đai là các lớp bao lồi lặp (bóc từng lớp). Tour đi hết một vòng vành đai ngoài, rồi chuyển sang vành đai trong gần điểm cuối nhất, cứ thế đến hết. Sau đó `uncross`. Script: `/tmp/claude-1000/-home-nhanjs-projects-physic/061ae57e-9a83-4a77-b243-cd165c2c5c75/scratchpad/layers.js`.

- Kết quả: trung bình 33.50% trên tối ưu, trúng tối ưu 7/75, còn 1/75 giao cắt sau `uncross`. Kém hơn cả biến thể B1.
- Nguyên nhân có thể: bước chuyển từ vòng ngoài sang vòng trong là cạnh dài; thứ tự vòng không được tối ưu. Chưa kiểm chứng.

**Biến thể B3: vành đai ngoài làm khung, chèn các điểm trong theo lớp (ngoài → trong) vào vị trí rẻ nhất.** Script: `/tmp/claude-1000/-home-nhanjs-projects-physic/061ae57e-9a83-4a77-b243-cd165c2c5c75/scratchpad/insert.js`.

- Kết quả: trung bình 0.27% trên tối ưu, trúng tối ưu 60/75. Tốt hơn farthest insertion (0.45%) trên cùng bộ 75 case.
- Còn 1/75 giao cắt: case `line` (các điểm thẳng hàng). Với điểm thẳng hàng, mọi tour đều có cạnh chồng lên nhau, nên không thể khử hết theo tiêu chí giao cắt. Đây là giới hạn của định nghĩa, không phải lỗi thuật toán.
- Chưa đo trên n lớn (> 12), vì không có Held-Karp làm chuẩn.

**Đo n lớn (điểm ngẫu nhiên đều trong [0,100]², chuẩn tham chiếu = tour ngắn nhất từ nhiều lần 2-opt và các tour ứng viên):** script `/tmp/claude-1000/-home-nhanjs-projects-physic/061ae57e-9a83-4a77-b243-cd165c2c5c75/scratchpad/bench.js`.

| n | Bộ | NN (1 điểm đầu) | Farthest insertion | Chèn vành đai (B3) | Địa hình + uncross | 2-opt từ thứ tự 0..n-1 |
|---|---|---|---|---|---|---|
| 20 | 20 | 12.69 | 1.27 | **0.84** | 13.11 | 3.57 |
| 40 | 20 | 23.10 | **3.39** | 4.89 | 13.76 | 4.68 |
| 80 | 10 | 20.98 | **2.21** | 7.28 | 13.35 | 4.08 |

(% trên chuẩn, trung bình. Chuẩn tham chiếu chứa cả tour FI và chèn-vành-đai nên hai cột này bị đánh giá thấp hơn thực tế một chút.)

- Chèn vành đai thắng FI ở n = 20 (11/20 bộ), nhưng thua rõ ở n = 40 và n = 80 (chỉ thắng 6/20 và 1/10).
- Ưu thế ở n nhỏ không giữ được khi n tăng. Với n lớn, nhiều lớp bao lồi, thứ tự chèn theo lớp có lẽ không còn tốt; chưa kiểm chứng.
- Chuẩn tham chiếu không phải tối ưu thật, nên các con số là tương đối, không phải sai số thật.

**B4: khung = vành đai ngoài, sau đó chèn điểm xa nhất khỏi tour hiện tại vào vị trí rẻ nhất.** Script: `scratchpad/farthestFrame.js` và `scratchpad/bench2.js`.

| n | Số bộ | Farthest insertion | B3 chèn vành đai | B4 khung + xa nhất | B4 thắng FI |
|---|---|---|---|---|---|
| 20 | 20 | 1.27 | 0.84 | **0.76** | 10/20 |
| 40 | 20 | **3.50** | 5.01 | 3.53 | 8/20 |
| 80 | 10 | **2.66** | 7.74 | 4.58 | 3/10 |

- Chuẩn tham chiếu được mở rộng để gồm cả B4, nên các con số FI và B3 ở đây khác với lần đo trước (ví dụ FI n = 40 là 3.50 thay vì 3.39). Không so sánh chéo giữa hai bảng.
- B4 gần FI hơn B3 khi n lớn, nhưng vẫn thua FI ở n = 40 và 80. Chèn theo khung vành đai không giúp ở n lớn.
- Kết luận: với các thuật toán chèn đã thử, farthest insertion vẫn là lựa chọn ổn định nhất khi n tăng.

**B5: khởi đầu bằng điểm cao nhất và thấp nhất, chèn theo lớp vành đai từ ngoài vào trong, trong mỗi lớp ưu tiên điểm gần điểm cao nhất.** Script: `scratchpad/extremes.js`, `scratchpad/bench3.js`.

| n | FI | B4 khung + xa nhất | B5 cực trị + lớp | B5 thắng FI |
|---|---|---|---|---|
| 20 | 1.27 | 0.76 | 3.55 | 6/20 |
| 40 | 3.50 | 3.53 | 5.06 | 6/20 |
| 80 | 2.66 | 4.58 | 5.61 | 2/10 |

- B5 thua B4 và FI ở mọi n. Thứ tự chèn theo lớp, dù có ưu tiên gần điểm cao nhất, vẫn làm tệ hơn chèn theo khoảng cách xa nhất.
- Chưa kiểm chứng nguyên nhân. Một giả thuyết: chèn theo lớp buộc các điểm xa phải đợi đến lớp của chúng, trong khi FI chèn điểm xa tour nhất ngay khi nó còn xa.

**B6: đi hết vành đai ngoài, rồi vành đai trong, tuần tự; mỗi vành đai là một chu trình bắt đầu từ điểm thấp nhất của nó.** Không dùng hàm chi phí. Script: `scratchpad/ringwalk.js`, `scratchpad/ringbig.js`.

- Trên n ≤ 12 (75 case, so với Held-Karp): trung bình 44.82%, trúng tối ưu 5/75. Dạng đi lại đầy đủ: 52.28%.
- Trên n = 20, 40, 80 (so với farthest insertion, cùng bộ điểm): cao hơn trung bình 86%, 126%, 158%.
- Nguyên nhân: mỗi vành đai đóng kín tại điểm thấp nhất của nó, và các vành đai bóc từ điểm ngẫu nhiên đều gồm nhiều lớp mỏng. Chuyển giữa các vành đai và đóng từng vòng tạo ra nhiều cạnh dài. Ràng buộc "bắt đầu từ điểm thấp nhất" cũng ép các điểm vào thứ tự cố định.
- Đi lại không cải thiện gì: với khoảng cách Euclid, các nhảy giữa vành đai đã là đoạn ngắn nhất có thể, nên dạng đi lại đầy đủ còn dài hơn.

**Cảnh báo về định nghĩa vành đai (chưa giải quyết):** từ B3 trở đi, tôi xác định "vành đai" là các lớp bao lồi lặp, không phải theo định nghĩa của người dùng (tour không giao cắt quanh các điểm bao quanh, các điểm bên trong là ngọn đồi, vành đai con là thành phần liên thông). Các kết luận về B3–B6 chỉ đúng với định nghĩa lớp bao lồi. Thống kê ngẫu nhiên: n = 20 có 3 lớp (11, 6, 3 điểm), n = 40 có 5 lớp (8, 9, 9, 8, 5 điểm), n = 80 có 9 lớp. Nhận xét trước đây rằng lớp "mỏng" là chưa được kiểm chứng và không đúng với số liệu này.

**Định nghĩa vành đai theo lựa chọn 3 (lớp bao lồi chỉ là vành đai nếu có ≥ m điểm; còn lại là đồi).** Script: `scratchpad/belts.js`. Cách A: khung là vành đai ngoài, chèn các điểm còn lại theo lớp. Cách B: đi vòng từng vành đai từ điểm thấp nhất, rồi chèn đồi.

| m | A: n≤12 (trúng/75) | A: n=20/40/80 so với FI | B: n≤12 (trúng/75) | B: n=20/40/80 so với FI |
|---|---|---|---|---|
| 3 | 0.27% (60) | +1.4% | 28.29% (19) | +88.5% |
| 5 | 0.29% (59) | +1.4% | 8.38% (50) | +82.7% |
| 8 | 0.19% (62) | +1.1% | 0.19% (62) | +49.1% |
| chỉ bao ngoài | 0.19% (62) | +0.5% | 0.19% (62) | +0.5% |

- Cách B chỉ tốt khi số vành đai ít. Càng nhiều vành đai nhỏ, các cạnh nối giữa vành đai càng nhiều, làm tệ đi nhanh.
- Cách A ổn định hơn, nhưng vẫn không vượt được "chỉ bao ngoài" (khung là bao lồi, phần còn lại chèn rẻ nhất).
- Tốt nhất trong bảng là "chỉ bao ngoài": ở n ≤ 12 đạt 0.19% so với Held-Karp, ở n lớn kém farthest insertion khoảng 0.5%. Điều này cho thấy các vành đai bên trong không mang thêm thông tin hữu ích trong các thử nghiệm này.
- Lưu ý: cột n=20/40/80 là so với farthest insertion, không phải tối ưu. Thứ tự chèn các đồi ở đây là theo chỉ số, không phải theo khoảng cách xa nhất.

**So sánh có kiểm chứng (script `scratchpad/compare.js`):**

n ≤ 12 (75 bộ, so với Held-Karp, trung bình / tệ nhất / trúng tối ưu):
- Vành đai (chỉ bao ngoài + chèn): 0.19% / 2.83% / 62
- Vành đai theo lớp (m=3 + chèn): 0.27% / 6.90% / 60
- Farthest insertion: 0.45% / 10.37% / 60
- Nearest neighbor (1 điểm đầu): 8.69% / 34.14% / 16
- Thứ tự chỉ số + 2-opt: 0.58% / 10.26% / 60
- FI + 2-opt: 0.29% / 5.44% / 65
- Vành đai + 2-opt: 0.09% / 2.83% / 69

n lớn (so với chuẩn tốt nhất tìm được; chuẩn này gồm cả kết quả của các thuật toán được so sánh nên đánh giá thấp hơn thực tế một chút):
- n = 20: vành đai 1.00%, vành đai theo lớp 0.81%, FI 1.25%, FI + 2-opt 0.92%, vành đai + 2-opt 0.63%
- n = 40: vành đai 3.47%, vành đai theo lớp 5.03%, FI 3.53%, FI + 2-opt 2.99%, vành đai + 2-opt 2.86%
- n = 80: vành đai 5.22%, vành đai theo lớp 7.38%, FI 2.30%, FI + 2-opt 1.52%, vành đai + 2-opt 3.57%

Kết luận: vành đai là thuật toán chính xác và ổn định ở n ≤ 12. Ở n lớn nó kém FI, và không phải lúc nào cũng tốt hơn FI + 2-opt. Số bộ ở n = 20, 40, 80 còn ít (20, 20, 10), nên các chênh lệch nhỏ hơn khoảng 1% chưa đáng tin.

**Nguyên nhân chênh lệch ở n lớn (script `scratchpad/why.js`):** so với farthest insertion (FI gốc), khung bao lồi + chèn rẻ nhất:
- n = 20: −0.2% đến −0.5% (tốt hơn một chút, trong nhiễu)
- n = 40: 0.0% đến +0.1% với khung + chỉ số, ngẫu nhiên, xa nhất; +1.8% với gần nhất
- n = 80: +2.9% (chỉ số), +2.5% (ngẫu nhiên), +2.0% (xa nhất khỏi tour), +4.5% (gần nhất)

Kết luận từ thử nghiệm: khung bao lồi không phải nguyên nhân duy nhất. Thứ tự chèn ảnh hưởng rõ khi n lớn: chèn điểm gần tour trước là tệ nhất. Chưa xác định cơ chế chính xác; giả thuyết là FI xây tour từ hai điểm và hấp thụ đồi khi tour còn nhỏ, còn khung bao lồi cố định ~10 đỉnh rồi phải chèn ~70 điểm vào các hõm có sẵn, và các quyết định tham lam sớm tích lũy. Mẫu n = 80 chỉ có 10 bộ, nên sai số có thể lớn.

**Bộ test chỉ gồm tập điểm liên thông** (đồ thị nối hai điểm khi khoảng cách ≤ 20 trong hộp [0,100]² phải liên thông). Sinh bằng cách thêm từng điểm trong bán kính 20 quanh một điểm đã có. Script: `scratchpad/connCases.js`, `scratchpad/compareConn2.js`, PRNG `scratchpad/rng.js`.

Lưu ý kỹ thuật: LCG cũ (`s*1103515245 + 12345`) bị lỗi độ chính xác số thực trong JS, có thể suy biến thành chu kỳ ngắn. Bộ này dùng mulberry32 thay thế. Các thử nghiệm trước đây với điểm ngẫu nhiên đều dùng LCG cũ, nên cần kiểm chứng lại.

n ≤ 12 (62 bộ liên thông, so với Held-Karp):
- Vành đai (chỉ bao ngoài + chèn): 0.24% / 1.91% / trúng 47
- Vành đai theo lớp (m=3 + chèn): 0.32% / 6.90% / 47
- Farthest insertion: 0.35% / 3.37% / 44
- Nearest neighbor (1 điểm đầu): 9.31% / 35.21% / 10
- Thứ tự chỉ số + 2-opt: 1.18% / 13.19% / 38
- FI + 2-opt: 0.28% / 3.37% / 49
- Vành đai + 2-opt: 0.17% / 1.91% / 50

n lớn (so với chuẩn tốt nhất tìm được):
- n = 20 (20 bộ): vành đai 1.59%, vành đai theo lớp 1.92%, FI 2.07%, FI + 2-opt 1.54%, vành đai + 2-opt 0.83%
- n = 40 (20 bộ): vành đai 3.76%, vành đai theo lớp 4.02%, FI 3.44%, FI + 2-opt 2.62%, vành đai + 2-opt 2.31%
- n = 80 (10 bộ): vành đai 2.67%, vành đai theo lớp 6.53%, FI 4.27%, FI + 2-opt 2.60%, vành đai + 2-opt 1.51%

Kết luận sơ bộ: trên tập liên thông, vành đai (kể cả khi chỉ dùng bao ngoài) không còn kém FI ở n lớn; ở n = 80 nó còn tốt hơn FI. Vành đai theo lớp (m=3) vẫn kém nhất ở n lớn. Số bộ n lớn còn ít, cần chạy thêm để kiểm chứng.

**Thêm Or-opt** (`scratchpad/oropt.js`, chạy trong `scratchpad/compareOr.js`). Or-opt: chuyển đoạn liên tiếp dài 1–3 sang vị trí khác, hai chiều, nhận nếu ngắn hơn, lặp đến khi không cải thiện.

n ≤ 12 (62 bộ, so với Held-Karp, đây là chuẩn chính xác):
- Vành đai + 2-opt + Or-opt: 0.00% trung bình, tệ nhất 0.28%, trúng 61/62
- FI + 2-opt + Or-opt: 0.00%, tệ nhất 0.28%, trúng 61/62

n lớn (chuẩn tham chiếu là tour tốt nhất trong các thuật toán được so sánh, gồm cả hai biến thể Or-opt, nên các con số Or-opt bị đánh giá thấp hơn thực tế):
- n = 20: vành đai + 2-opt + Or-opt 0.18%, FI + 2-opt + Or-opt 0.53%
- n = 40: vành đai + 2-opt + Or-opt 1.21%, FI + 2-opt + Or-opt 0.86%
- n = 80: vành đai + 2-opt + Or-opt 0.70%, FI + 2-opt + Or-opt 1.01%

Kết luận: Or-opt cải thiện rõ cả hai nền. Ở n ≤ 12, cả hai gần như chạm tối ưu. Ở n lớn, hai biến thể gần ngang nhau, và không đủ dữ liệu (10–20 bộ) để nói biến thể nào tốt hơn.

**Tập liên thông, n lớn hơn** (`scratchpad/bigN.js`). Chuẩn = min(các thuật toán, 2-opt + Or-opt từ 5 hoán vị ngẫu nhiên). Chuẩn này yếu ở n lớn vì chỉ có 5 lần khởi động ngẫu nhiên, nên các con số là cận dưới của độ lệch thật.

| n (số bộ) | Vành đai + 2-opt + Or-opt | FI + 2-opt + Or-opt | Vành đai + 2-opt | FI + 2-opt | FI |
|---|---|---|---|---|---|
| 100 (15) | 2.04% | 2.02% | 5.33% | 5.40% | 6.43% |
| 150 (10) | 1.56% | 1.75% | 5.40% | 4.73% | 5.84% |
| 200 (8) | 1.04% | 2.26% | 4.78% | 5.74% | 6.62% |

Kết luận: ở n ≥ 100, hai biến thể có Or-opt gần ngang nhau, nhưng biến thể vành đai có xu hướng tốt hơn khi n tăng (1.04% so với 2.26% ở n = 200). Số bộ vẫn ít, nên chưa kết luận chắc.

**Các dạng hình học liên thông** (`scratchpad/typeCases.js`, `scratchpad/typeBench.js`). Mọi tập được kiểm tra liên thông với T = 20. Chuẩn: Held-Karp với n ≤ 12; với n = 40, 80 là min các thuật toán cộng 5 lần 2-opt + Or-opt ngẫu nhiên.

n ≤ 12 (8 bộ mỗi dạng, trúng tối ưu / tổng):
- Vòng tròn, hai vòng đồng tâm: cả ba thuật toán đều tối ưu (cạnh vòng tròn là tour tối ưu, không phân biệt được).
- Vòng ngoài + đồi trong: vành đai+Or-opt 0.22–0.25%, trúng 5/8 và 7/8; FI+Or-opt 0.22–0.70%; FI 1.45–1.80%.
- Lưới có nhiễu: vành đai+Or-opt 0.00% (n=10, 12 trúng 7–8/8); FI+Or-opt 0.00–0.41%; FI 0–4.11%.
- Chuỗi cụm, bước đi ngẫu nhiên, ngẫu nhiên đều: vành đai và FI+Or-opt đều gần tối ưu; FI thuần kém hơn rõ.

n = 40, 80 (6 bộ mỗi dạng, độ lệch trung bình):

| Dạng | n | Vành đai+2opt+Oropt | FI+2opt+Oropt | FI |
|---|---|---|---|---|
| Vòng ngoài + đồi trong | 40 | 4.11% | 3.83% | 10.42% |
| Vòng ngoài + đồi trong | 80 | **5.34%** | 10.53% | 17.59% |
| Lưới có nhiễu | 40 | **1.14%** | 1.86% | 5.70% |
| Lưới có nhiễu | 80 | **0.70%** | 0.82% | 4.55% |
| Chuỗi cụm | 40 | **0.19%** | 0.47% | 1.81% |
| Chuỗi cụm | 80 | **0.31%** | 1.08% | 2.94% |
| Bước đi ngẫu nhiên | 40 | **1.09%** | 1.44% | 6.10% |
| Bước đi ngẫu nhiên | 80 | **1.84%** | 2.45% | 5.10% |
| Ngẫu nhiên đều | 40 | 2.38% | **1.45%** | 4.60% |
| Ngẫu nhiên đều | 80 | **1.70%** | 1.95% | 6.24% |

**So sánh với Held-Karp (tối ưu chính xác), n = 12, 14, 16, 18, 8 bộ mỗi dạng** (`scratchpad/hkBench.js`). Tổng hợp trên 256 trường hợp:
- Vành đai: trung bình 1.19%, trúng tối ưu 139/256
- Vành đai + 2-opt + Or-opt: trung bình 0.37%, trúng tối ưu 209/256
- FI: trung bình 1.44%, trúng tối ưu 122/256
- FI + 2-opt + Or-opt: trung bình 0.39%, trúng tối ưu 206/256

Theo dạng, ở n = 16–18 với "vòng ngoài + đồi trong", vành đai + 2-opt + Or-opt đạt 0.31% và 1.35%, FI + 2-opt + Or-opt đạt 1.04% và 1.68%. Ở "chuỗi cụm" cả hai biến thể có Or-opt đều tối ưu 8/8 ở n ≥ 14. Dạng "hai vòng đồng tâm" n = 18 cho cả bốn thuật toán cùng độ lệch 2.25%, không trúng: tập này có tối ưu không nằm trong nhóm thứ tự mà các thuật toán dựng ra.

Ghi chú: "Vòng ngoài + đồi trong" là hình dạng gần với mô tả vành đai và đồi của bạn. Ở đây vành đai+Or-opt tốt hơn FI+Or-opt ở n = 80 (5.34% so với 10.53%), nhưng không ở n = 40 (4.11% so với 3.83%). Hai dạng vòng đồng tâm không sinh được tập liên thông ở n ≥ 40 với T = 20 do khoảng cách giữa các điểm trên vòng vượt ngưỡng.

**B6 biến thể: bắt đầu mỗi vành đai từ điểm cao nhất thay vì thấp nhất.** Script: `scratchpad/ringwalk2.js`, `scratchpad/high.js`.

- n ≤ 12: 45.84% (cao nhất) so với 44.82% (thấp nhất); trúng tối ưu 7/75 so với 5/75.
- n = 20, 40, 80 (so với farthest insertion): cao hơn trung bình 88.6%, 125.5%, 163.9% (cao nhất) so với 86.0%, 125.6%, 158.1% (thấp nhất).
- Kết luận: chọn điểm bắt đầu không cứu được B6. Vấn đề nằm ở cấu trúc vòng-lớp, không phải ở điểm bắt đầu.
- NN ở đây lấy điểm bắt đầu tốt nhất trong n điểm, nên thuận lợi hơn NN một điểm bắt đầu. Chưa đo NN một điểm bắt đầu.

**Kết luận sơ bộ:** quy tắc địa hình thuần túy kém hơn NN và farthest insertion. Nó chỉ tốt hơn sau khi khử giao cắt, và vẫn kém. Nếu muốn giữ hướng này, nên dùng nó làm tour khởi đầu cho 2-opt/Or-opt, rồi đo lại.
