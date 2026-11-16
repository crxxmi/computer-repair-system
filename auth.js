
const express = require("express");
const bcrypt = require("bcrypt");
const pool = require("./db");

const router = express.Router();

router.post("/register", async (req, res) => {
  const { fullName, email, password } = req.body;

  if (
    typeof fullName !== "string" ||
    typeof email !== "string" ||
    typeof password !== "string" ||
    !fullName.trim() ||
    !email.trim() ||
    password.length < 8
  ) {
    return res.status(400).json({
      error: "กรุณากรอกชื่อ อีเมล และรหัสผ่านอย่างน้อย 8 ตัวอักษร"
    });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO users (full_name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, full_name AS "fullName", email, role, created_at AS "createdAt"`,
      [fullName.trim(), email.trim().toLowerCase(), passwordHash]
    );

    res.status(201).json({
      message: "สมัครสมาชิกสำเร็จ",
      user: result.rows[0]
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        error: "อีเมลนี้ถูกสมัครสมาชิกแล้ว"
      });
    }

    console.error("Register error:", error.message);
    res.status(500).json({
      error: "เกิดข้อผิดพลาดในการสมัครสมาชิก"
    });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    !email.trim() ||
    !password
  ) {
    return res.status(400).json({
      error: "กรุณากรอกอีเมลและรหัสผ่าน"
    });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({
      error: "ยังไม่ได้ตั้งค่า JWT_SECRET"
    });
  }

  try {
    const result = await pool.query(
      `SELECT id, full_name, email, password_hash, role
       FROM users WHERE email = $1`,
      [email.trim().toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
      });
    }

    const user = result.rows[0];
    const passwordMatches = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordMatches) {
      return res.status(401).json({
        error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
      });
    }

    const jwt = require("jsonwebtoken");
    const token = jwt.sign(
      {
        id: user.id,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: "2h" }
    );

    res.json({
      message: "เข้าสู่ระบบสำเร็จ",
      token,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error("Login error:", error.message);
    res.status(500).json({
      error: "เกิดข้อผิดพลาดในการเข้าสู่ระบบ"
    });
  }
});

module.exports = router;
