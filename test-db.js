
const pool = require("./db");

async function testConnection() {
  try {
    const result = await pool.query(
      "SELECT current_database() AS database, NOW() AS server_time"
    );

    console.log("เชื่อมต่อ PostgreSQL สำเร็จ!");
    console.log(result.rows[0]);
  } catch (error) {
    console.error("เชื่อมต่อไม่สำเร็จ:", error.message);
  } finally {
    await pool.end();
  }
}

testConnection();
