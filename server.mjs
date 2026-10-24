import "dotenv/config";
import express from "express";
import multer from "multer";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(root, "data", "appointments");
const app = express();
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 15, fieldSize: 5000 },
});
const schema = z
  .object({
    name: z.string().trim().min(2, "Enter your full name.").max(100),
    phone: z
      .string()
      .trim()
      .min(10, "Enter a valid phone number.")
      .max(25)
      .refine(
        (s) =>
          /^[+\d()\s.\-]+$/.test(s) &&
          s.replace(/\D/g, "").length >= 10 &&
          s.replace(/\D/g, "").length <= 15,
        "Enter a valid phone number.",
      ),
    email: z.union([z.literal(""), z.email().max(254)]).default(""),
    zip: z.string().regex(/^\d{5}$/, "Enter a 5-digit ZIP code."),
    propertyType: z.enum(["House", "Townhouse", "Other"]),
    service: z.enum([
      "Roof Repair",
      "Roof Replacement",
      "Storm Damage",
      "Roof Inspection",
      "Not Sure",
    ]),
    description: z.string().max(3000).default(""),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine((v) => {
        const d = new Date(v + "T12:00:00");
        return (
          !isNaN(d.valueOf()) &&
          d.toISOString().slice(0, 10) === v &&
          v >= new Date().toLocaleDateString("en-CA")
        );
      }, "Choose today or a future date."),
    time: z.enum(["Morning", "Afternoon", "Flexible"]),
    contactMethod: z.enum(["Phone", "Email", "WhatsApp"]),
    consent: z.literal("true", { error: "Your consent is required." }),
    website: z.string().max(0).optional(),
  })
  .refine((v) => v.contactMethod !== "Email" || !!v.email, {
    path: ["email"],
    message: "Add your email to use this contact method.",
  });
const attempts = new Map();
app.get("/api/booking-status", (_req, res) =>
  res.json({
    mode: process.env.APPOINTMENT_WEBHOOK_URL ? "connected" : "local",
  }),
);
app.post(
  "/api/appointments",
  (req, res, next) => {
    const origin = req.get("origin");
    if (origin) {
      try {
        if (new URL(origin).host !== req.get("host"))
          return res
            .status(403)
            .json({ message: "This request must come from the website." });
      } catch {
        return res.status(403).json({ message: "Invalid origin." });
      }
    }
    const ip = req.ip;
    const now = Date.now();
    const entry = attempts.get(ip) || [];
    const recent = entry.filter((t) => now - t < 3600000);
    if (recent.length >= 20)
      return res
        .status(429)
        .json({ message: "Too many requests. Please try again later." });
    recent.push(now);
    attempts.set(ip, recent);
    next();
  },
  upload.single("photo"),
  async (req, res) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = {};
      for (const issue of result.error.issues)
        errors[issue.path[0]] = issue.message;
      return res
        .status(400)
        .json({ message: "Please check the highlighted fields.", errors });
    }
    let extension = "";
    if (req.file) {
      const b = req.file.buffer;
      if (b.length >= 3 && b[0] === 255 && b[1] === 216 && b[2] === 255)
        extension = "jpg";
      else if (
        b.length >= 8 &&
        b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      )
        extension = "png";
      else if (
        b.length >= 12 &&
        b.toString("ascii", 0, 4) === "RIFF" &&
        b.toString("ascii", 8, 12) === "WEBP"
      )
        extension = "webp";
      if (
        !extension ||
        !["image/jpeg", "image/png", "image/webp"].includes(req.file.mimetype)
      )
        return res.status(400).json({
          message: "Use a JPG, PNG, or WebP image, up to 5 MB.",
          errors: { photo: "This image format is not supported." },
        });
    }
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const record = {
      id,
      createdAt,
      ...result.data,
      photo: extension ? `${id}.${extension}` : null,
      status: "local-only",
    };
    delete record.website;
    try {
      await mkdir(dataDir, { recursive: true, mode: 0o700 });
      if (extension)
        await writeFile(path.join(dataDir, record.photo), req.file.buffer, {
          mode: 0o600,
        });
      if (process.env.APPOINTMENT_WEBHOOK_URL) {
        // A live integration must accept multipart form data and return a 2xx response.
        const payload = new FormData();
        payload.append("request", JSON.stringify(record));
        if (req.file)
          payload.append(
            "photo",
            new Blob([req.file.buffer], { type: req.file.mimetype }),
            record.photo,
          );
        const response = await fetch(process.env.APPOINTMENT_WEBHOOK_URL, {
          method: "POST",
          body: payload,
          headers: process.env.WEBHOOK_TOKEN
            ? { Authorization: `Bearer ${process.env.WEBHOOK_TOKEN}` }
            : {},
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok)
          throw new Error("Delivery integration rejected request");
        record.status = "delivered";
      }
      await writeFile(
        path.join(dataDir, id + ".json"),
        JSON.stringify(record, null, 2),
        { mode: 0o600 },
      );
      return res.status(201).json({
        id,
        mode: record.status === "delivered" ? "connected" : "local",
        message:
          record.status === "delivered"
            ? "Your request was delivered. Your appointment is not confirmed until the team contacts you."
            : "Your request was saved to this preview’s local inbox. It has not been sent to a roofing company, and no appointment has been booked.",
      });
    } catch (error) {
      console.error("Appointment processing failed:", error.message);
      if (extension)
        await unlink(path.join(dataDir, record.photo)).catch(() => {});
      return res.status(503).json({
        message:
          "We could not complete your request. No appointment is confirmed. Please try again later.",
      });
    }
  },
);
app.use("/api", (_req, res) => res.status(404).json({ message: "Not found" }));
app.use((error, _req, res, next) => {
  if (error instanceof multer.MulterError)
    return res.status(400).json({
      message:
        error.code === "LIMIT_FILE_SIZE"
          ? "Your image must be smaller than 5 MB."
          : "The upload could not be accepted.",
      errors: { photo: "Use one JPG, PNG, or WebP file, up to 5 MB." },
    });
  next(error);
});
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(root, "dist")));
  app.get("/{*path}", (_req, res) =>
    res.sendFile(path.join(root, "dist", "index.html")),
  );
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: {
      middlewareMode: true,
      allowedHosts: true,
      fs: {
        deny: [".env", ".env.*", "*.{crt,pem}", "**/data/**", "**/server.mjs"],
      },
    },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
app.listen(Number(process.env.PORT) || 3000, "0.0.0.0", () =>
  console.log(
    "Apex Roofing website listening on port " + (process.env.PORT || 3000),
  ),
);
