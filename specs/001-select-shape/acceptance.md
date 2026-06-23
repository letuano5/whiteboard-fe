# Acceptance Criteria Registry — P1A-02 Select Shape

> Append-only. AC-n IDs are frozen once any test references them.
> Source: spec.md acceptance scenarios + functional requirements.

AC-1: Khi user click vào bên trong bounding box của một shape (select tool đang active), shape đó phải có ID trong `selectedIds` và bounding box overlay phải xuất hiện quanh shape đó.

AC-2: Khi hai shape chồng nhau tại điểm click, shape có `zIndex` cao hơn phải được chọn.

AC-3: Khi user click vào shape B trong khi shape A đang được chọn, chỉ shape B có trong `selectedIds` (A bị bỏ chọn).

AC-4: Khi user click vào vùng trống canvas (không trúng shape nào), `selectedIds` phải trở thành mảng rỗng và bounding box overlay phải biến mất.

AC-5: Khi user click vào vùng trống canvas và không có shape nào đang được chọn, trạng thái không đổi và không có lỗi.

AC-6: Trạng thái chọn (`selectedIds`) chỉ tồn tại trong `interactionStore.selectedIds` — KHÔNG được ghi vào `elementsStore` hoặc localStorage.

AC-7: Khi một shape được chọn, bounding box overlay phải hiện 8 handle: 4 góc (nw, ne, sw, se) + 4 cạnh giữa (n, s, e, w).
