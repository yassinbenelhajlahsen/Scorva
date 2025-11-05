import { Router } from "express";

const router = Router();

const normalizeBaseUrl = (url = "") => url.replace(/\/$/, "");

const resolveInternalBaseUrl = (req) => {
  const configured = process.env.INTERNAL_API_URL;
  if (configured && configured.trim().length > 0) {
    return normalizeBaseUrl(configured.trim());
  }

  const forwardedProto = req.headers["x-forwarded-proto"];
  const protocolHeader = Array.isArray(forwardedProto)
    ? forwardedProto[0]
    : forwardedProto?.split(",")[0]?.trim();
  const protocol = protocolHeader || req.protocol;
  return `${protocol}://${req.get("host")}`;
};

router.use("/proxy", async (req, res) => {
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  try {
    const baseUrl = resolveInternalBaseUrl(req);
    const targetPath = req.originalUrl.replace(/^\/api\/proxy/, "/api");
    const targetUrl = new URL(targetPath, `${baseUrl}/`).toString();

    if (!process.env.API_KEY) {
      return res.status(500).json({ error: "API key not configured" });
    }

    const fetchOptions = {
      method: req.method,
      headers: {
        "x-api-key": process.env.API_KEY ?? "",
      },
    };

    if (
      !["GET", "HEAD"].includes(req.method) &&
      req.body &&
      Object.keys(req.body).length > 0
    ) {
      fetchOptions.headers["content-type"] =
        req.headers["content-type"] || "application/json";
      fetchOptions.body =
        fetchOptions.headers["content-type"] === "application/json"
          ? JSON.stringify(req.body)
          : req.body;
    }

    const response = await fetch(targetUrl, fetchOptions);
    const contentType = response.headers.get("content-type") || "";

    if (response.status === 204) {
      return res.status(response.status).end();
    }

    if (contentType.includes("application/json")) {
      try {
        const data = await response.json();
        return res.status(response.status).json(data);
      } catch (err) {
        console.error("Failed to parse proxied JSON response:", err);
        const text = await response.text();
        return res
          .status(response.status)
          .set("content-type", contentType)
          .send(text);
      }
    }

    const buffer = await response.arrayBuffer();
    return res
      .status(response.status)
      .set("content-type", contentType || "application/octet-stream")
      .send(Buffer.from(buffer));
  } catch (error) {
    console.error("Proxy request failed:", error);
    return res.status(500).json({ error: "Failed to proxy request" });
  }
});

export default router;
