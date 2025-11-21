// server.js
const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const { PrismaClient } = require("@prisma/client");
const { v4: uuid } = require("uuid");
const pinoHttp = require("pino-http");
const logger = require("../utils/logger");
const helmet = require("helmet");
const { apiLimiter } = require("../utils/rateLimiters");

const prisma = new PrismaClient({
  log:
    process.env.NODE_ENV === "development"
      ? ["query", "info", "warn", "error"]
      : ["warn", "error"],
});

const app = express();
const port = process.env.PORT || 3000;

const router = require("../routes/routes");
const verifyToken = require("../middleware");
const { toJSONSafe } = require("../utils/jsonBigInt");

// Helpers
const toBi = (v) => {
  const s = String(v);
  if (!/^\d+$/.test(s)) throw new Error(`Invalid ID: ${s}`);
  return BigInt(s);
};

// Request ID (for correlation across logs)
app.use((req, res, next) => {
  req.id = uuid();
  res.setHeader("x-request-id", req.id);
  next();
});

// Request logging middleware
app.use(
  pinoHttp({
    logger,
    autoLogging: true,
    customProps: (req) => ({ requestId: req.id }),
    customLogLevel: (res, err) => {
      if (err) return "error";
      if (res.statusCode >= 500) return "error";
      if (res.statusCode >= 400) return "warn";
      return "info";
    },
  })
);

app.use(
  helmet({
    hidePoweredBy: true,

    dnsPrefetchControl: { allow: false },

    ieNoOpen: true,

    noSniff: true,

    frameguard: { action: "sameorigin" },

    xssFilter: true,

    hsts:
      process.env.NODE_ENV === "production"
        ? {
            maxAge: 15552000, // 180 days
            includeSubDomains: false,
            preload: false,
          }
        : false,

    crossOriginOpenerPolicy: { policy: "same-origin" },
    crossOriginResourcePolicy: { policy: "cross-origin" },

    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "base-uri": ["'self'"],
        "form-action": ["'self'"],

        "connect-src": [
          "'self'",
          // "http://localhost:3000",
          // "http://localhost:5173",
          process.env.FRONTEND_ORIGIN,
          "https://floor-track-backend.onrender.com",
          "https://securetoken.googleapis.com",
          "https://identitytoolkit.googleapis.com",
        ],

        "img-src": ["'self'", "data:", "blob:"],

        "style-src": ["'self'"],

        "script-src": ["'self'"],

        "font-src": ["'self'", "data:"],

        "object-src": ["'none'"],

        "frame-src": ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// CORS, parsers
app.use(
  cors({
    origin: [process.env.FRONTEND_ORIGIN || "http://localhost:5173"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(apiLimiter);

app.use(router);

// Public minimal endpoints
app.get("/", (req, res) => {
  logger.info({ requestId: req.id }, "Hello World requested");
  res.send("Hello World!");
});

app.get("/api/health", (req, res) => {
  logger.debug({ requestId: req.id }, "Health check");
  res.json({
    message: "Server is running",
    timestamp: new Date().toISOString(),
  });
});

// Diagnostics (protected)
app.get("/api/diag", verifyToken, async (req, res) => {
  try {
    const now = await prisma.$queryRaw`SELECT NOW()`;
    logger.info({ uid: req.user?.uid, requestId: req.id }, "Diagnostics OK");
    res.json(toJSONSafe({ ok: true, uid: req.user?.uid, db: now }));
  } catch (e) {
    logger.error({ err: e, requestId: req.id }, "Diagnostics failed");
    res.status(500).json({ error: e.message });
  }
});

// Current user profile (protected)
app.get("/api/me", verifyToken, async (req, res) => {
  try {
    const u = await prisma.users.findUnique({
      where: { firebaseUid: req.user.uid },
      include: { role: true, userGroups: { include: { group: true } } },
    });
    logger.info({ uid: req.user.uid, requestId: req.id }, "/api/me loaded");
    res.json(toJSONSafe({ firebaseUid: req.user.uid, user: u }));
  } catch (e) {
    logger.error(
      { err: e, uid: req.user?.uid, requestId: req.id },
      "/api/me failed"
    );
    res.status(500).json({ error: e.message });
  }
});

/**
 * Floor details: svgMap (protected) — STRICT floor-only
 */
app.get("/api/floors/:floorId", verifyToken, async (req, res) => {
  try {
    const user = await prisma.users.findUnique({
      where: { firebaseUid: req.user.uid },
      include: { role: true, userGroups: true },
    });
    if (!user) {
      logger.warn(
        { uid: req.user?.uid, requestId: req.id },
        "Floor details unauthorized"
      );
      return res.status(403).json({ error: "Unauthorized" });
    }

    const floorId = toBi(req.params.floorId);

    if (user.role?.name !== "Owner") {
      const groupIds = (user.userGroups || []).map((ug) => ug.groupId);
      if (groupIds.length === 0) {
        logger.warn(
          { uid: req.user?.uid, floorId: String(floorId), requestId: req.id },
          "Floor details forbidden: no groups"
        );
        return res.status(403).json({ error: "Forbidden" });
      }

      const allowed = await prisma.globalPermissions.findFirst({
        where: { floorId, groupId: { in: groupIds } },
        select: { id: true },
      });

      if (!allowed) {
        logger.warn(
          { uid: req.user?.uid, floorId: String(floorId), requestId: req.id },
          "Floor details forbidden: GP missing"
        );
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    const floor = await prisma.floors.findUnique({
      where: { id: floorId },
      select: { id: true, name: true, svgMap: true },
    });
    if (!floor) {
      logger.warn(
        { uid: req.user?.uid, floorId: String(floorId), requestId: req.id },
        "Floor not found"
      );
      return res.status(404).json({ error: "Floor not found" });
    }

    logger.info(
      { uid: req.user?.uid, floorId: String(floorId), requestId: req.id },
      "Floor details fetched"
    );
    res.json({
      id: floor.id.toString(),
      name: floor.name,
      svgMap: floor.svgMap,
    });
  } catch (err) {
    logger.error(
      {
        err,
        floorId: req.params.floorId,
        uid: req.user?.uid,
        requestId: req.id,
      },
      "Error fetching floor"
    );
    res.status(500).json({ error: "Failed to fetch floor" });
  }
});

// Floors list (protected) — STRICT floor-only
app.get("/api/floors", verifyToken, async (req, res) => {
  try {
    const user = await prisma.users.findUnique({
      where: { firebaseUid: req.user.uid },
      include: { role: true, userGroups: true },
    });
    if (!user) {
      logger.warn(
        { uid: req.user?.uid, requestId: req.id },
        "Floors list unauthorized"
      );
      return res.status(403).json({ error: "Unauthorized" });
    }

    const role = user.role?.name || "";
    let floors = [];

    if (role === "Owner") {
      floors = await prisma.floors.findMany({
        select: {
          id: true,
          name: true,
          building: { select: { id: true, name: true } },
        },
        orderBy: { id: "asc" },
      });
    } else if (
      role === "Organization Admin" ||
      role === "Site Admin" ||
      role === "Viewer"
    ) {
      const groupIds = (user.userGroups || []).map((ug) => ug.groupId);
      if (groupIds.length === 0) {
        logger.info(
          { uid: req.user?.uid, role, requestId: req.id },
          "Floors list empty: no groups"
        );
        return res.json([]);
      }
      floors = await prisma.floors.findMany({
        where: { globalPermissions: { some: { groupId: { in: groupIds } } } },
        select: {
          id: true,
          name: true,
          building: { select: { id: true, name: true } },
        },
        orderBy: { id: "asc" },
      });
    } else {
      logger.info(
        { uid: req.user?.uid, role, requestId: req.id },
        "Floors list empty: role not allowed"
      );
      return res.json([]);
    }

    const payload = floors.map((f) => ({
      id: f.id.toString(),
      name: f.name,
      buildingId: f.building?.id?.toString?.() ?? null,
      buildingName: f.building?.name ?? null,
    }));

    logger.info(
      { uid: req.user?.uid, count: payload.length, role, requestId: req.id },
      "Floors listed"
    );
    res.json(payload);
  } catch (err) {
    logger.error(
      { err, uid: req.user?.uid, requestId: req.id },
      "Error fetching floors"
    );
    res.status(500).json({ error: "Failed to fetch floors" });
  }
});

// Floor’s building (protected) — STRICT floor-only
app.get("/api/floors/:floorId/building", verifyToken, async (req, res) => {
  try {
    const user = await prisma.users.findUnique({
      where: { firebaseUid: req.user.uid },
      include: { role: true, userGroups: true },
    });
    if (!user) {
      logger.warn(
        { uid: req.user?.uid, requestId: req.id },
        "Floor building unauthorized"
      );
      return res.status(403).json({ error: "Unauthorized" });
    }

    const floorId = toBi(req.params.floorId);

    if (user.role?.name !== "Owner") {
      const groupIds = (user.userGroups || []).map((ug) => ug.groupId);
      if (groupIds.length === 0) {
        logger.warn(
          { uid: req.user?.uid, floorId: String(floorId), requestId: req.id },
          "Floor building forbidden: no groups"
        );
        return res.status(403).json({ error: "Forbidden" });
      }

      const allowed = await prisma.globalPermissions.findFirst({
        where: { floorId, groupId: { in: groupIds } },
        select: { id: true },
      });

      if (!allowed) {
        logger.warn(
          { uid: req.user?.uid, floorId: String(floorId), requestId: req.id },
          "Floor building forbidden: GP missing"
        );
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    const floor = await prisma.floors.findUnique({
      where: { id: floorId },
      select: { building: { select: { id: true, name: true } } },
    });

    if (!floor || !floor.building) {
      logger.warn(
        { uid: req.user?.uid, floorId: String(floorId), requestId: req.id },
        "Building not found for floor"
      );
      return res.status(404).json({ error: "Building not found for floor" });
    }

    logger.info(
      {
        uid: req.user?.uid,
        floorId: String(floorId),
        buildingId: String(floor.building.id),
        requestId: req.id,
      },
      "Floor building fetched"
    );
    res.json({ id: floor.building.id.toString(), name: floor.building.name });
  } catch (err) {
    logger.error(
      {
        err,
        floorId: req.params.floorId,
        uid: req.user?.uid,
        requestId: req.id,
      },
      "Error fetching building for floor"
    );
    res.status(500).json({ error: "Failed to fetch building" });
  }
});

// Stats: devices-by-ap for a specific floor (protected, STRICT floor-only)
app.get("/api/stats/devices-by-ap", verifyToken, async (req, res) => {
  try {
    const floorIdParam = req.query.floorId;
    if (!floorIdParam) {
      logger.warn(
        { uid: req.user?.uid, requestId: req.id },
        "devices-by-ap missing floorId"
      );
      return res.status(400).json({ error: "floorId query param is required" });
    }
    const floorId = toBi(floorIdParam);

    const user = await prisma.users.findUnique({
      where: { firebaseUid: req.user.uid },
      include: { role: true, userGroups: true },
    });
    if (!user) {
      logger.warn(
        { uid: req.user?.uid, requestId: req.id },
        "devices-by-ap unauthorized"
      );
      return res.status(403).json({ error: "Unauthorized" });
    }

    if (user.role?.name !== "Owner") {
      const groupIds = (user.userGroups || []).map((ug) => ug.groupId);
      if (groupIds.length === 0) {
        logger.warn(
          { uid: req.user?.uid, floorId: String(floorId), requestId: req.id },
          "devices-by-ap forbidden: no groups"
        );
        return res.status(403).json({ error: "Forbidden" });
      }
      const allowed = await prisma.globalPermissions.findFirst({
        where: { floorId, groupId: { in: groupIds } },
        select: { id: true },
      });
      if (!allowed) {
        logger.warn(
          { uid: req.user?.uid, floorId: String(floorId), requestId: req.id },
          "devices-by-ap forbidden: GP missing"
        );
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    const aps = await prisma.aPs.findMany({
      where: { floorId },
      select: {
        id: true,
        name: true,
        cx: true,
        cy: true,
        _count: { select: { client: true } },
      },
      orderBy: { id: "asc" },
    });

    const payload = aps.map((ap) => ({
      apId: ap.id.toString(),
      title: ap.name,
      cx: ap.cx,
      cy: ap.cy,
      deviceCount: ap._count.client,
    }));

    logger.info(
      {
        uid: req.user?.uid,
        floorId: String(floorId),
        count: payload.length,
        requestId: req.id,
      },
      "devices-by-ap fetched"
    );
    res.json({ floorId: floorId.toString(), aps: payload });
  } catch (error) {
    logger.error(
      { err: error, uid: req.user?.uid, requestId: req.id },
      "Error fetching devices-by-ap"
    );
    res.status(500).json({ error: "Failed to fetch devices-by-ap" });
  }
});

// Totals: devices on a specific floor (protected, STRICT floor-only)
app.get("/api/stats/total-devices", verifyToken, async (req, res) => {
  try {
    const floorIdParam = req.query.floorId;
    if (!floorIdParam) {
      logger.warn(
        { uid: req.user?.uid, requestId: req.id },
        "total-devices missing floorId"
      );
      return res.status(400).json({ error: "floorId query param is required" });
    }
    const floorId = toBi(floorIdParam);

    const user = await prisma.users.findUnique({
      where: { firebaseUid: req.user.uid },
      include: { role: true, userGroups: true },
    });
    if (!user) {
      logger.warn(
        { uid: req.user?.uid, requestId: req.id },
        "total-devices unauthorized"
      );
      return res.status(403).json({ error: "Unauthorized" });
    }

    if (user.role?.name !== "Owner") {
      const groupIds = (user.userGroups || []).map((ug) => ug.groupId);
      if (groupIds.length === 0) {
        logger.warn(
          { uid: req.user?.uid, floorId: String(floorId), requestId: req.id },
          "total-devices forbidden: no groups"
        );
        return res.status(403).json({ error: "Forbidden" });
      }
      const allowed = await prisma.globalPermissions.findFirst({
        where: { floorId, groupId: { in: groupIds } },
        select: { id: true },
      });
      if (!allowed) {
        logger.warn(
          { uid: req.user?.uid, floorId: String(floorId), requestId: req.id },
          "total-devices forbidden: GP missing"
        );
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    const totalDevices = await prisma.clients.count({
      where: { ap: { floorId } },
    });
    logger.info(
      {
        uid: req.user?.uid,
        floorId: String(floorId),
        totalDevices,
        requestId: req.id,
      },
      "total-devices fetched"
    );
    res.json({ floorId: floorId.toString(), totalDevices });
  } catch (error) {
    logger.error(
      { err: error, uid: req.user?.uid, requestId: req.id },
      "Error fetching device count"
    );
    res.status(500).json({ error: "Failed to fetch devices" });
  }
});

// Totals: APs on a specific floor (protected, STRICT floor-only)
app.get("/api/stats/total-aps", verifyToken, async (req, res) => {
  try {
    const floorIdParam = req.query.floorId;
    if (!floorIdParam) {
      logger.warn(
        { uid: req.user?.uid, requestId: req.id },
        "total-aps missing floorId"
      );
      return res.status(400).json({ error: "floorId query param is required" });
    }
    const floorId = toBi(floorIdParam);

    const user = await prisma.users.findUnique({
      where: { firebaseUid: req.user.uid },
      include: { role: true, userGroups: true },
    });
    if (!user) {
      logger.warn(
        { uid: req.user?.uid, requestId: req.id },
        "total-aps unauthorized"
      );
      return res.status(403).json({ error: "Unauthorized" });
    }

    if (user.role?.name !== "Owner") {
      const groupIds = (user.userGroups || []).map((ug) => ug.groupId);
      if (groupIds.length === 0) {
        logger.warn(
          { uid: req.user?.uid, floorId: String(floorId), requestId: req.id },
          "total-aps forbidden: no groups"
        );
        return res.status(403).json({ error: "Forbidden" });
      }
      const allowed = await prisma.globalPermissions.findFirst({
        where: { floorId, groupId: { in: groupIds } },
        select: { id: true },
      });
      if (!allowed) {
        logger.warn(
          { uid: req.user?.uid, floorId: String(floorId), requestId: req.id },
          "total-aps forbidden: GP missing"
        );
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    const totalAps = await prisma.aPs.count({ where: { floorId } });
    logger.info(
      {
        uid: req.user?.uid,
        floorId: String(floorId),
        totalAps,
        requestId: req.id,
      },
      "total-aps fetched"
    );
    res.json({ floorId: floorId.toString(), totalAps });
  } catch (error) {
    logger.error(
      { err: error, uid: req.user?.uid, requestId: req.id },
      "Error fetching AP count"
    );
    res.status(500).json({ error: "Failed to fetch APs" });
  }
});

// Create client device (protected)
app.post("/api/clients", verifyToken, async (req, res) => {
  try {
    const { mac, apId } = req.body;
    if (!mac || !apId) {
      logger.warn(
        { uid: req.user?.uid, requestId: req.id },
        "Create client missing mac/apId"
      );
      return res.status(400).json({ error: "mac and apId are required" });
    }

    const created = await prisma.clients.create({
      data: { mac, apId: toBi(apId) },
      select: { id: true, mac: true, apId: true, createdAt: true },
    });

    logger.info(
      {
        uid: req.user?.uid,
        clientId: String(created.id),
        apId: String(created.apId),
        requestId: req.id,
      },
      "Client created"
    );
    res.json({
      id: created.id.toString(),
      mac: created.mac,
      apId: created.apId.toString(),
      createdAt: created.createdAt,
    });
  } catch (error) {
    logger.error(
      { err: error, uid: req.user?.uid, requestId: req.id },
      "Error creating client device"
    );
    res.status(500).json({ error: "Failed to create client" });
  }
});

// AP connection(s) for a user's registered devices (protected)
app.get("/api/users/:userId/ap-connection", verifyToken, async (req, res) => {
  try {
    const userId = toBi(req.params.userId);

    const userRow = await prisma.users.findUnique({
      where: { id: userId },
      select: { firebaseUid: true },
    });

    if (!userRow) {
      logger.warn(
        { requestId: req.id, userId: req.params.userId },
        "ap-connection user not found"
      );
      return res.status(404).json({ error: "User not found" });
    }

    if (req.user?.uid !== userRow.firebaseUid) {
      logger.warn(
        {
          requestId: req.id,
          uid: req.user?.uid,
          targetUid: userRow.firebaseUid,
        },
        "ap-connection forbidden: mismatched uid"
      );
      return res.status(403).json({ error: "Forbidden" });
    }

    const devices = await prisma.userDevices.findMany({
      where: { userId },
      select: { mac: true },
      orderBy: { id: "asc" },
    });

    if (!devices.length) {
      logger.info(
        { requestId: req.id, uid: req.user?.uid, userId: req.params.userId },
        "ap-connection no registered MACs"
      );
      return res
        .status(404)
        .json({ error: "User has no registered device MAC" });
    }

    const results = [];
    for (const d of devices) {
      const normalizedMac = d.mac.trim().toLowerCase();

      const client = await prisma.clients.findFirst({
        where: { mac: { equals: normalizedMac, mode: "insensitive" } },
        orderBy: { updatedAt: "desc" },
        select: {
          apId: true,
          updatedAt: true,
          ap: { select: { id: true, name: true, floorId: true } },
        },
      });

      results.push({
        mac: normalizedMac,
        ap: client?.ap
          ? {
              id: client.ap.id.toString(),
              name: client.ap.name,
              floorId: client.ap.floorId?.toString(),
            }
          : null,
        updatedAt: client?.updatedAt ?? null,
      });
    }

    logger.info(
      { requestId: req.id, uid: req.user?.uid, count: results.length },
      "ap-connection resolved"
    );
    return res.json({ connections: results });
  } catch (error) {
    logger.error(
      { err: error, requestId: req.id, uid: req.user?.uid },
      "ap-connection lookup failed"
    );
    return res.status(500).json({ error: "Failed to resolve AP connection" });
  }
});

app.listen(port, () => {
  logger.info({ port }, "Server listening");
});
