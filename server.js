require("dotenv").config();
const express = require("express");
const axios = require("axios");
const app = express();
const port = 3000;

app.use(express.static("public"));

// Hàm lấy Token từ Lark
async function getLarkToken() {
  try {
    const res = await axios.post(
      "https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal",
      {
        app_id: process.env.LARK_APP_ID,
        app_secret: process.env.LARK_APP_SECRET,
      }
    );
    return res.data.tenant_access_token;
  } catch (error) {
    console.error("Lỗi lấy Token:", error.response?.data || error.message);
    throw new Error("Sai App ID hoặc App Secret");
  }
}

app.get("/api/print-data", async (req, res) => {
  try {
    const recordId = req.query.id;
    if (!recordId) return res.status(400).json({ error: "Thiếu Record ID" });

    const token = await getLarkToken();
    const headers = { Authorization: `Bearer ${token}` };

    // 1. Lấy Master Record (Phiếu xuất)
    const masterUrl = `https://open.larksuite.com/open-apis/bitable/v1/apps/${process.env.APP_TOKEN}/tables/${process.env.TABLE_MASTER_ID}/records/${recordId}`;
    const masterRes = await axios.get(masterUrl, { headers });
    const mFields = masterRes.data.data.record.fields;

    // 2. Lấy Detail Records (Chi tiết vật tư)
    // Filter: Tìm các dòng mà cột "Link to Master" (LINK_FIELD_ID) có chứa recordId này
    const filter = `CurrentValue.[${process.env.LINK_FIELD_ID}] contains "${recordId}"`;
    const detailUrl = `https://open.larksuite.com/open-apis/bitable/v1/apps/${
      process.env.APP_TOKEN
    }/tables/${process.env.TABLE_DETAIL_ID}/records?filter=${encodeURIComponent(
      filter
    )}`;

    const detailRes = await axios.get(detailUrl, { headers });
    const items = detailRes.data.data.items || [];

    // 3. Chuẩn hóa dữ liệu trả về (Mapping)
    // Tên cột bên phải phải giống hệt trên Lark Base của bạn
    const responseData = {
      soPhieu: mFields["Số phiếu"] || "",
      nhaXuong: mFields["Xưởng"]?.text || mFields["Xưởng"] || "", // Xử lý nếu là dạng Text hoặc Option
      ngayNhap: mFields["Ngày xuất nhập"] || "",
      nhaCungCap:
        mFields["Nhà cung cấp"]?.text || mFields["Nhà cung cấp"] || "",
      noiDung: mFields["Nội dung xuất"] || "",
      items: items.map((i) => ({
        maVt: i.fields["Mã vật tư"] || "",
        tenVt: i.fields["Tên vật tư, thiết bị"] || "",
        dvt: i.fields["Đơn vị tính"] || "",
        quyCach: i.fields["Quy cách, Mã hiệu"] || "", // Đã sửa theo ảnh của bạn
        nhanHieu: i.fields["Nhãn hiệu"] || "",
        slDeNghi: i.fields["SL đề nghị đợt này"] || "", // Đã sửa theo ảnh của bạn
        ghiChu: i.fields["Ghi chú"] || "",
      })),
    };

    res.json(responseData);
  } catch (error) {
    console.error("API Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Lỗi Server", detail: error.message });
  }
});

app.listen(port, () => console.log(`Server running on port ${port}`));
