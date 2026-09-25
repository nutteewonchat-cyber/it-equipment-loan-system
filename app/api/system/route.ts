import { env } from "cloudflare:workers";
import { headers } from "next/headers";

const seedEquipment = [
  ["IT-0001", "โน้ตบุ๊ก Dell Latitude 5420", "โน้ตบุ๊ก", "Dell Latitude 5420", "DL5420-TH-031", "ห้อง IT ชั้น 2", "borrowed"],
  ["IT-0002", "MacBook Air M2", "โน้ตบุ๊ก", "Apple MacBook Air M2", "FVFGH29PQ6L4", "ห้อง IT ชั้น 2", "available"],
  ["IT-0003", "โปรเจคเตอร์ Epson EB-X06", "โปรเจคเตอร์", "Epson EB-X06", "X6K2201841", "ห้องโสตฯ", "available"],
  ["IT-0004", "กล้องเว็บแคม Logitech C920", "อุปกรณ์ประชุม", "Logitech C920", "C920-99281", "ตู้ A-03", "available"],
  ["IT-0005", "เมาส์ไร้สาย Logitech M331", "อุปกรณ์เสริม", "Logitech M331", "M331-88204", "ตู้ A-01", "maintenance"],
  ["IT-0006", "สาย HDMI 2 เมตร", "สายสัญญาณ", "UGREEN 2M", "HDMI-0182", "ตู้ A-02", "available"],
  ["IT-0007", "Router TP-Link Archer AX23", "อุปกรณ์เครือข่าย", "TP-Link Archer AX23", "AX23-77310", "ห้อง Network", "damaged"],
] as const;

async function identity() {
  const h = await headers();
  return {
    id: h.get("oai-authenticated-user-id") ?? "demo-admin",
    email: h.get("oai-authenticated-user-email") ?? "admin@example.org",
    name: decodeURIComponent(h.get("oai-authenticated-user-full-name") ?? "ผู้ดูแลระบบ"),
  };
}

async function bootstrap() {
  const db = env.DB;
  const count = await db.prepare("SELECT COUNT(*) AS total FROM equipment").first<{ total: number }>();
  if ((count?.total ?? 0) === 0) {
    await db.batch(seedEquipment.map((x) => db.prepare(
      "INSERT INTO equipment(asset_code,name,category,brand_model,serial_number,location,status) VALUES(?,?,?,?,?,?,?)"
    ).bind(...x)));
  }
  const user = await identity();
  const users = await db.prepare("SELECT COUNT(*) AS total FROM users").first<{ total: number }>();
  await db.prepare(
    "INSERT OR IGNORE INTO users(auth_id,email,name,role) VALUES(?,?,?,?)"
  ).bind(user.id, user.email, user.name, (users?.total ?? 0) === 0 ? "admin" : "user").run();
  await db.batch([
    ...["โน้ตบุ๊ก","โปรเจคเตอร์","อุปกรณ์ประชุม","อุปกรณ์เสริม","สายสัญญาณ","อุปกรณ์เครือข่าย"].map(name =>
      db.prepare("INSERT OR IGNORE INTO categories(name) VALUES(?)").bind(name)),
    ...["ห้อง IT ชั้น 2","ห้องโสตฯ","ตู้ A-01","ตู้ A-02","ตู้ A-03","ห้อง Network"].map(name =>
      db.prepare("INSERT OR IGNORE INTO locations(name) VALUES(?)").bind(name)),
    db.prepare("INSERT OR IGNORE INTO system_settings(key,value) VALUES('max_borrow_days','14')"),
    db.prepare("INSERT OR IGNORE INTO system_settings(key,value) VALUES('reminder_days','3')"),
    db.prepare("INSERT OR IGNORE INTO system_settings(key,value) VALUES('require_approval','true')"),
  ]);

  const loans = await db.prepare("SELECT COUNT(*) AS total FROM loan_requests").first<{ total: number }>();
  if ((loans?.total ?? 0) === 0) {
    const due = new Date(); due.setDate(due.getDate() + 2);
    const start = new Date(); start.setDate(start.getDate() - 3);
    const result = await db.prepare(
      "INSERT INTO loan_requests(request_code,borrower_auth_id,borrower_name,start_at,due_at,purpose,status) VALUES(?,?,?,?,?,?,?)"
    ).bind("BR-260901", "sample-user", "พิมพ์ชนก วัฒนะ", start.toISOString(), due.toISOString(), "นำเสนอผลงานนอกสถานที่", "borrowed").run();
    await db.prepare("INSERT INTO loan_items(request_id,equipment_id,condition_before) VALUES(?,?,?)")
      .bind(result.meta.last_row_id, 1, "ปกติ").run();
  }
}

export async function GET() {
  try {
    await bootstrap();
    const db = env.DB;
    const [equipment, requests, user, users, categories, locations, settings] = await Promise.all([
      db.prepare("SELECT * FROM equipment WHERE active=1 ORDER BY id").all(),
      db.prepare(`SELECT r.*, GROUP_CONCAT(e.name, ' • ') AS item_names, COUNT(li.id) AS item_count
        FROM loan_requests r LEFT JOIN loan_items li ON li.request_id=r.id
        LEFT JOIN equipment e ON e.id=li.equipment_id GROUP BY r.id ORDER BY r.created_at DESC`).all(),
      identity(),
      db.prepare("SELECT id,auth_id,email,name,role,active,created_at FROM users ORDER BY created_at").all(),
      db.prepare("SELECT id,name,active FROM categories WHERE active=1 ORDER BY name").all(),
      db.prepare("SELECT id,name,active FROM locations WHERE active=1 ORDER BY name").all(),
      db.prepare("SELECT key,value FROM system_settings").all(),
    ]);
    const role = await db.prepare("SELECT role,active FROM users WHERE auth_id=?").bind(user.id).first();
    const visibleRequests = role?.role === "admin"
      ? requests.results
      : (requests.results ?? []).filter((row: any) => row.borrower_auth_id === user.id);
    return Response.json({
      equipment: equipment.results, requests: visibleRequests, users: role?.role === "admin" ? users.results : [],
      categories: categories.results, locations: locations.results,
      settings: Object.fromEntries((settings.results ?? []).map((x: any) => [x.key,x.value])),
      user: { ...user, ...role }
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "ไม่สามารถโหลดข้อมูลได้ในขณะนี้" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const db = env.DB;
  const user = await identity();
  const body = await request.json() as Record<string, unknown>;
  try {
    const account = await db.prepare("SELECT role,active FROM users WHERE auth_id=?").bind(user.id).first<{role:string;active:number}>();
    if (!account?.active) return Response.json({ error: "บัญชีนี้ถูกปิดการใช้งาน" }, { status: 403 });
    const adminActions = new Set(["setStatus","saveEquipment","disableEquipment","return","saveUser","toggleUser","saveSettings","saveReference"]);
    if (adminActions.has(String(body.action)) && account?.role !== "admin") {
      return Response.json({ error: "เฉพาะผู้ดูแลระบบเท่านั้น" }, { status: 403 });
    }
    if (body.action === "createLoan") {
      const ids = Array.isArray(body.equipmentIds) ? body.equipmentIds.map(Number) : [];
      const startAt = String(body.startAt ?? "");
      const dueAt = String(body.dueAt ?? "");
      if (!ids.length || !startAt || !dueAt || dueAt <= startAt || !String(body.purpose ?? "").trim()) {
        return Response.json({ error: "กรุณากรอกข้อมูลคำขอให้ครบถ้วน" }, { status: 400 });
      }
      const maxSetting = await db.prepare("SELECT value FROM system_settings WHERE key='max_borrow_days'").first<{value:string}>();
      const maxDays = Math.max(1,Number(maxSetting?.value ?? 14));
      if ((new Date(dueAt).getTime()-new Date(startAt).getTime())/86400000 > maxDays) {
        return Response.json({ error: `ระยะเวลายืมสูงสุด ${maxDays} วัน` }, { status: 400 });
      }
      const marks = ids.map(() => "?").join(",");
      const conflict = await db.prepare(`SELECT e.name FROM loan_items li
        JOIN loan_requests r ON r.id=li.request_id JOIN equipment e ON e.id=li.equipment_id
        WHERE li.equipment_id IN (${marks}) AND r.status IN ('pending','approved','borrowed','overdue')
        AND r.start_at < ? AND r.due_at > ? LIMIT 1`).bind(...ids, dueAt, startAt).first<{name:string}>();
      if (conflict) return Response.json({ error: `${conflict.name} มีคำขอในช่วงเวลานี้แล้ว` }, { status: 409 });
      const code = `BR-${new Date().toISOString().slice(2,10).replaceAll("-","")}-${Math.floor(100+Math.random()*900)}`;
      const approvalSetting = await db.prepare("SELECT value FROM system_settings WHERE key='require_approval'").first<{value:string}>();
      const initialStatus = approvalSetting?.value === "false" ? "approved" : "pending";
      const row = await db.prepare(`INSERT INTO loan_requests
        (request_code,borrower_auth_id,borrower_name,start_at,due_at,purpose,notes,status)
        VALUES(?,?,?,?,?,?,?,?)`).bind(code,user.id,user.name,startAt,dueAt,String(body.purpose),String(body.notes??""),initialStatus).run();
      await db.batch(ids.map(id => db.prepare("INSERT INTO loan_items(request_id,equipment_id) VALUES(?,?)").bind(row.meta.last_row_id,id)));
      return Response.json({ ok: true, code });
    }
    if (body.action === "setStatus") {
      const status = String(body.status);
      if (!["approved","rejected","borrowed"].includes(status)) throw new Error("invalid status");
      const id = Number(body.requestId);
      await db.prepare("UPDATE loan_requests SET status=?,approved_by=?,approved_at=CURRENT_TIMESTAMP WHERE id=?")
        .bind(status,user.name,id).run();
      if (status === "borrowed") await db.prepare(
        "UPDATE equipment SET status='borrowed' WHERE id IN (SELECT equipment_id FROM loan_items WHERE request_id=?)"
      ).bind(id).run();
      return Response.json({ ok: true });
    }
    if (body.action === "saveEquipment") {
      const fields = [body.assetCode, body.name, body.category, body.brandModel, body.serialNumber, body.location, body.status, body.notes].map(v => String(v ?? ""));
      if (!fields[0] || !fields[1] || !fields[2] || !fields[5]) return Response.json({ error: "กรุณากรอกข้อมูลอุปกรณ์ที่จำเป็น" }, { status: 400 });
      if (body.id) {
        await db.prepare(`UPDATE equipment SET asset_code=?,name=?,category=?,brand_model=?,serial_number=?,location=?,status=?,notes=? WHERE id=?`)
          .bind(...fields, Number(body.id)).run();
      } else {
        await db.prepare(`INSERT INTO equipment(asset_code,name,category,brand_model,serial_number,location,status,notes) VALUES(?,?,?,?,?,?,?,?)`)
          .bind(...fields).run();
      }
      return Response.json({ ok: true });
    }
    if (body.action === "disableEquipment") {
      await db.prepare("UPDATE equipment SET active=0 WHERE id=?").bind(Number(body.id)).run();
      return Response.json({ ok: true });
    }
    if (body.action === "saveUser") {
      const name = String(body.name ?? "").trim();
      const email = String(body.email ?? "").trim().toLowerCase();
      const role = body.role === "admin" ? "admin" : "user";
      if (!name || !email.includes("@")) return Response.json({ error: "กรุณาระบุชื่อและอีเมลให้ถูกต้อง" }, { status: 400 });
      const authId = String(body.authId ?? `invited-${crypto.randomUUID()}`);
      if (body.id) {
        await db.prepare("UPDATE users SET name=?,email=?,role=? WHERE id=?").bind(name,email,role,Number(body.id)).run();
      } else {
        await db.prepare("INSERT INTO users(auth_id,email,name,role) VALUES(?,?,?,?)").bind(authId,email,name,role).run();
      }
      return Response.json({ ok: true });
    }
    if (body.action === "toggleUser") {
      await db.prepare("UPDATE users SET active=? WHERE id=?").bind(body.active ? 1 : 0,Number(body.id)).run();
      return Response.json({ ok: true });
    }
    if (body.action === "saveSettings") {
      const rows = [
        ["max_borrow_days", String(Math.max(1,Number(body.maxBorrowDays ?? 14)))],
        ["reminder_days", String(Math.max(0,Number(body.reminderDays ?? 3)))],
        ["require_approval", body.requireApproval ? "true" : "false"],
      ];
      await db.batch(rows.map(([key,value]) => db.prepare(
        "INSERT INTO system_settings(key,value,updated_at) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP"
      ).bind(key,value)));
      return Response.json({ ok: true });
    }
    if (body.action === "saveReference") {
      const table = body.kind === "location" ? "locations" : "categories";
      const name = String(body.name ?? "").trim();
      if (!name) return Response.json({ error: "กรุณาระบุชื่อ" }, { status: 400 });
      await db.prepare(`INSERT OR IGNORE INTO ${table}(name) VALUES(?)`).bind(name).run();
      return Response.json({ ok: true });
    }
    if (body.action === "return") {
      const id = Number(body.requestId);
      const condition = String(body.condition ?? "normal");
      const items = await db.prepare("SELECT equipment_id FROM loan_items WHERE request_id=?").bind(id).all<{equipment_id:number}>();
      await db.batch((items.results ?? []).flatMap(item => [
        db.prepare(`INSERT OR REPLACE INTO returns(request_id,equipment_id,condition_after,damage_details,damage_photo_key,fine_amount,notes,received_by)
          VALUES(?,?,?,?,?,?,?,?)`).bind(id,item.equipment_id,condition,String(body.damageDetails??""),String(body.photoName??"")||null,Number(body.fineAmount??0),String(body.notes??""),user.name),
        db.prepare("UPDATE equipment SET status=? WHERE id=?").bind(condition==="damaged"?"damaged":"available",item.equipment_id),
      ]));
      await db.prepare("UPDATE loan_requests SET status='returned' WHERE id=?").bind(id).run();
      return Response.json({ ok: true });
    }
    return Response.json({ error: "คำสั่งไม่ถูกต้อง" }, { status: 400 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}
