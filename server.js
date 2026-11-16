const express = require("express");
const pool = require("./db");
const authRouter = require("./auth");
const { verifyToken, allowRoles } = require("./authMiddleware");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static("public"));
app.use("/api/auth", authRouter);

app.get("/", (req, res) => {
  res.json({
    message: "Computer Repair Booking and Tracking System API"
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    message: "Server is running"
  });
});

app.get(
  "/api/repairs",
  verifyToken,
  allowRoles("customer", "technician", "admin"),
  async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT
          id,
          customer_name AS "customerName",
          device,
          problem,
          status,
          created_at AS "createdAt",
          estimated_price AS "estimatedPrice",
          estimate_note AS "estimateNote",
          approval_status AS "approvalStatus",
          payment_status AS "paymentStatus",
          payment_method AS "paymentMethod",
          paid_at AS "paidAt"
         FROM repair_requests
         WHERE ($1 IN ('technician', 'admin') OR user_id = $2)
         ORDER BY id`,
        [req.user.role, req.user.id]
      );

      res.json(result.rows);
    } catch (error) {
      console.error("ดึงข้อมูลแจ้งซ่อมไม่สำเร็จ:", error);
      res.status(500).json({
        error: "ไม่สามารถดึงข้อมูลแจ้งซ่อมได้"
      });
    }
  }
);

app.post(
  "/api/repairs",
  verifyToken,
  allowRoles("customer", "admin"),
  async (req, res) => {
    const { customerName, device, problem } = req.body;

    if (!customerName || !device || !problem) {
      return res.status(400).json({
        error: "กรุณากรอกชื่อผู้แจ้ง อุปกรณ์ และปัญหาที่พบ"
      });
    }

    try {
      const result = await pool.query(
        `INSERT INTO repair_requests
          (customer_name, device, problem, user_id)
         VALUES ($1, $2, $3, $4)
         RETURNING
          id,
          customer_name AS "customerName",
          device,
          problem,
          status,
          created_at AS "createdAt",
          user_id AS "userId"`,
        [customerName, device, problem, req.user.id]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("บันทึกข้อมูลแจ้งซ่อมไม่สำเร็จ:", error);
      res.status(500).json({
        error: "ไม่สามารถบันทึกข้อมูลแจ้งซ่อมได้"
      });
    }
  }
);

app.patch(
  "/api/repairs/:id/estimate",
  verifyToken,
  allowRoles("technician", "admin"),
  async (req, res) => {
    const id = Number(req.params.id);
    const { estimatedPrice, estimateNote } = req.body;

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        error: "รหัสรายการซ่อมไม่ถูกต้อง"
      });
    }

    if (
      estimatedPrice === undefined ||
      !Number.isFinite(Number(estimatedPrice)) ||
      Number(estimatedPrice) < 0
    ) {
      return res.status(400).json({
        error: "กรุณาระบุราคาประเมินให้ถูกต้อง"
      });
    }

    try {
      const result = await pool.query(
        `UPDATE repair_requests
         SET estimated_price = $1,
             estimate_note = $2,
             approval_status = 'waiting',
             payment_status = 'unpaid'
         WHERE id = $3
         RETURNING
           id,
           estimated_price AS "estimatedPrice",
           estimate_note AS "estimateNote",
           approval_status AS "approvalStatus",
           payment_status AS "paymentStatus"`,
        [Number(estimatedPrice), estimateNote || null, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: "ไม่พบรายการแจ้งซ่อม"
        });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error("ประเมินราคาซ่อมไม่สำเร็จ:", error);
      res.status(500).json({
        error: "ไม่สามารถบันทึกราคาประเมินได้"
      });
    }
  }
);

app.patch(
  "/api/repairs/:id/payment",
  verifyToken,
  allowRoles("customer"),
  async (req, res) => {
    const id = Number(req.params.id);
    const { paymentMethod } = req.body;

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        error: "รหัสรายการซ่อมไม่ถูกต้อง"
      });
    }

    if (!["promptpay", "bank_transfer", "cash"].includes(paymentMethod)) {
      return res.status(400).json({
        error: "วิธีชำระเงินไม่ถูกต้อง"
      });
    }

    try {
      const result = await pool.query(
        `UPDATE repair_requests
         SET payment_status = 'paid',
             payment_method = $1,
             paid_at = NOW()
         WHERE id = $2
           AND user_id = $3
           AND approval_status = 'approved'
           AND payment_status = 'unpaid'
           AND estimated_price IS NOT NULL
         RETURNING
           id,
           estimated_price AS "estimatedPrice",
           payment_status AS "paymentStatus",
           payment_method AS "paymentMethod",
           paid_at AS "paidAt"`,
        [paymentMethod, id, req.user.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: "ไม่พบรายการหรือรายการนี้ยังไม่พร้อมชำระเงิน"
        });
      }

      res.json({
        message: "ชำระเงินจำลองสำเร็จ",
        ...result.rows[0]
      });
    } catch (error) {
      console.error("ชำระเงินไม่สำเร็จ:", error);
      res.status(500).json({
        error: "ไม่สามารถบันทึกการชำระเงินได้"
      });
    }
  }
);

app.patch(
  "/api/repairs/:id/status",
  verifyToken,
  allowRoles("technician", "admin"),
  async (req, res) => {
    console.log("PATCH STATUS ROUTE:", req.params.id);
    const { status } = req.body;
    const id = Number(req.params.id);
    const allowedStatuses = ["pending", "in_progress", "completed"];

    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({
        error: "รหัสรายการซ่อมไม่ถูกต้อง"
      });
    }

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        error: "สถานะไม่ถูกต้อง"
      });
    }

    try {
      const result = await pool.query(
        `UPDATE repair_requests
         SET status = $1
         WHERE id = $2
         RETURNING id, customer_name AS "customerName", device, problem, status`,
        [status, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: "ไม่พบรายการแจ้งซ่อม"
        });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error("แก้ไขสถานะไม่สำเร็จ:", error);
      res.status(500).json({
        error: "ไม่สามารถแก้ไขสถานะได้"
      });
    }
  }
);

app.patch(
  "/api/repairs/:id/approval",
  verifyToken,
  allowRoles("customer"),
  async (req, res) => {
    const id = Number(req.params.id);
    const { approvalStatus } = req.body;

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        error: "รหัสรายการซ่อมไม่ถูกต้อง"
      });
    }

    if (!["approved", "rejected"].includes(approvalStatus)) {
      return res.status(400).json({
        error: "สถานะอนุมัติไม่ถูกต้อง"
      });
    }

    try {
      const result = await pool.query(
        `UPDATE repair_requests
         SET approval_status = $1
         WHERE id = $2
           AND user_id = $3
           AND approval_status = 'waiting'
           AND estimated_price IS NOT NULL
         RETURNING
           id,
           approval_status AS "approvalStatus"`,
        [approvalStatus, id, req.user.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: "ไม่พบรายการหรือไม่สามารถอนุมัติราคาได้"
        });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error("อนุมัติราคาไม่สำเร็จ:", error);
      res.status(500).json({
        error: "ไม่สามารถบันทึกการอนุมัติได้"
      });
    }
  }
);

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
