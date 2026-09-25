import { env } from "cloudflare:workers";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !file.type.startsWith("image/")) {
      return Response.json({ error: "กรุณาเลือกไฟล์รูปภาพ" }, { status: 400 });
    }
    if (file.size > 8 * 1024 * 1024) {
      return Response.json({ error: "รูปภาพต้องมีขนาดไม่เกิน 8 MB" }, { status: 400 });
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `damage/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
    await env.BUCKET.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
    return Response.json({ key });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "อัปโหลดรูปภาพไม่สำเร็จ" }, { status: 500 });
  }
}
