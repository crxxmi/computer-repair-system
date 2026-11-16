
const jwt = require("jsonwebtoken");

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "กรุณาเข้าสู่ระบบก่อน"
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      error: "Token ไม่ถูกต้องหรือหมดอายุ"
    });
  }
}

function allowRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: "คุณไม่มีสิทธิ์เข้าถึงส่วนนี้"
      });
    }

    next();
  };
}

module.exports = { verifyToken, allowRoles };