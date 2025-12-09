require("dotenv").config();
const express = require("express");
const axios = require("axios");
const path = require("path");

const app = express();
const port = process.env.PORT || 3000;

// Serve file tĩnh (HTML, CSS) từ thư mục public
app.use(express.static("public"));

// Hàm lấy Tenant Access Token từ Lark
async function getLarkToken() {
  const url =
    "https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal";
  const res = await axios.post(url, {
    app_id: process.env.LARK_APP_ID,
    app_secret: process.env.LARK_APP_SECRET,
  });
  return res.data.tenant_access_token;
}

// API Endpoint: Frontend gọi vào đây để lấy dữ liệu
app.get("/api/print-data", async (req, res) => {
  try {
    const recordId = req.query.id;
    if (!recordId) return res.status(400).json({ error: "Thiếu Record ID" });

    const token = await getLarkToken();
    const headers = { Authorization: `Bearer ${token}` };
    const appToken = process.env.APP_TOKEN;

    // 1. Lấy thông tin Master (Phiếu xuất)
    const masterUrl = `https://open.larksuite.com/open-apis/bitable/v1/apps/${appToken}/tables/${process.env.TABLE_MASTER_ID}/records/${recordId}`;
    const masterRes = await axios.get(masterUrl, { headers });
    const masterFields = masterRes.data.data.record.fields;

    // 2. Lấy danh sách Detail (Chi tiết vật tư)
    // Dùng filter để chỉ lấy các dòng thuộc phiếu này
    // Lưu ý: Filter trong Lark API khá phức tạp, đây là cách filter chính xác theo Link Record
    const filterFormula = `CurrentValue.[${process.env.LINK_FIELD_ID}] contains "${recordId}"`;

    const detailUrl = `https://open.larksuite.com/open-apis/bitable/v1/apps/${appToken}/tables/${
      process.env.TABLE_DETAIL_ID
    }/records?filter=${encodeURIComponent(filterFormula)}`;

    const detailRes = await axios.get(detailUrl, { headers });
    const detailRecords = detailRes.data.data.items || [];

    // 3. Gom dữ liệu trả về (Mapping fields)
    // Bạn nhớ kiểm tra Field Name/ID trong Lark cho chính xác nhé
    const responseData = {
      soPhieu: masterFields["Số phiếu"],
      nhaXuong: masterFields["Xưởng"]?.text || masterFields["Xưởng"], // Xử lý nếu là object
      ngayNhap: masterFields["Ngày xuất nhập"],
      nhaCungCap:
        masterFields["Nhà cung cấp"]?.text || masterFields["Nhà cung cấp"],
      noiDung: masterFields["Nội dung xuất"],
      items: detailRecords.map((item) => ({
        maVt: item.fields["Mã vật tư"],
        tenVt: item.fields["Tên vật tư, thiết bị"],
        dvt: item.fields["Đơn vị tính"],
        quyCach: item.fields["Quy cách, Mã hiệu"],
        nhanHieu: item.fields["Nhãn hiệu"],
        slDeNghi: item.fields["SL đề nghị đợt này"],
        ghiChu: item.fields["Ghi chú"],
      })),
    };

    res.json(responseData);
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: "Lỗi server", detail: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server đang chạy tại http://localhost:${port}`);
});
